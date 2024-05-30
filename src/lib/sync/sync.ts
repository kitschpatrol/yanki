import { setNoteIdInFrontmatter } from '../model/frontmatter'
import { type YankiNote } from '../model/yanki-note'
import { getNoteFromMarkdown } from '../parse/parse'
import {
	addNote,
	deleteNote,
	deleteNotes,
	findNotes,
	getRemoteNotes,
	updateNote,
} from './anki-connect-utilities'
import { deepmerge } from 'deepmerge-ts'
import fs from 'node:fs/promises'
import path from 'node:path'
import { YankiConnect, type YankiConnectOptions } from 'yanki-connect'

type SyncedNote = { action: 'created' | 'recreated' | 'unchanged' | 'updated'; note: YankiNote }

export type SyncOptions = {
	ankiConnectOptions: YankiConnectOptions
	defaultDeckName: string
	dryRun: boolean
	modelPrefix: string
}

const defaultSyncOptions: SyncOptions = {
	ankiConnectOptions: {
		autoLaunchAnki: true,
	},
	defaultDeckName: 'Yanki',
	dryRun: false,
	modelPrefix: 'Yanki - ',
}

/**
 * Syncs local notes to Anki.
 *
 * @param allLocalNotes All the YankiNotes to sync
 * @returns The synced notes (with new IDs where applicable), plus some stats
 * about the sync @throws
 */
export async function syncNotes(
	allLocalNotes: YankiNote[],
	options?: Partial<SyncOptions>,
): Promise<{
	deleted: number[]
	duration: number
	synced: SyncedNote[]
}> {
	const startTime = performance.now()

	// Defaults
	const { ankiConnectOptions, defaultDeckName, dryRun, modelPrefix } = deepmerge(
		defaultSyncOptions,
		options ?? {},
	)

	const synced: SyncedNote[] = []
	const replaced: number[] = []

	const client = new YankiConnect(ankiConnectOptions)

	const remoteNoteIds = await findNotes(client, modelPrefix)

	// Deletion pass
	const orphans = remoteNoteIds.filter(
		(note) => !allLocalNotes.some((localNote) => localNote.noteId === note),
	)

	await deleteNotes(client, orphans, dryRun)

	// Set undefined local note decks to the default
	for (const note of allLocalNotes) {
		if (note.deckName === undefined) {
			console.log('Setting deck name')
			note.deckName = defaultDeckName
		}
	}

	// Set undefined local note IDs to bogus ones to ensure we create them
	const localNoteIds = allLocalNotes.map((note) => note.noteId).map((id) => id ?? -1)
	const remoteNotes = await getRemoteNotes(client, localNoteIds, modelPrefix)

	// Creation and update pass
	for (const [index, remoteNote] of remoteNotes.entries()) {
		const localNote = allLocalNotes[index]

		// Undefined means the note only exists locally
		if (remoteNote === undefined) {
			// Ensure id is undefined, in case the local id is corrupted (e.g. changed
			// by hand)

			const newNoteId = await addNote(
				client,
				{ ...localNote, noteId: undefined },
				modelPrefix,
				dryRun,
			)

			synced.push({
				action: 'created',
				note: {
					...localNote,
					noteId: newNoteId,
				},
			})
		} else if (localNote.modelName === remoteNote.modelName) {
			// Update remote notes if they differ
			const wasUpdated = await updateNote(client, localNote, remoteNote, dryRun)

			synced.push({
				action: wasUpdated ? 'updated' : 'unchanged',
				note: localNote,
			})
		} else {
			// Model change, need to recreate TODO is there a way to "update" a note
			// model?

			if (remoteNote.noteId === undefined) {
				throw new Error('Remote note ID is undefined')
			}

			replaced.push(remoteNote.noteId)
			await deleteNote(client, remoteNote, dryRun)
			const newNoteId = await addNote(
				client,
				{ ...localNote, noteId: undefined },
				modelPrefix,
				dryRun,
			)

			synced.push({
				action: 'recreated',
				note: {
					...localNote,
					noteId: newNoteId,
				},
			})
		}
	}

	return {
		deleted: [...orphans, ...replaced],
		duration: performance.now() - startTime,
		synced,
	}
}

type SyncedNoteFile = {
	filePath: string
} & SyncedNote

/**
 * Sync a list of local yanki-md files to Anki.
 *
 * Wraps the syncNotes function to handle file I/O.
 *
 * Most importantly, it updates the note IDs in the frontmatter of the local
 * files.
 *
 * @param allLocalFilePaths Array of paths to the local markdown files
 * @returns The synced files (with new IDs where applicable), plus some stats
 * about the sync @throws
 */
export async function syncFiles(
	allLocalFilePaths: string[],
	options?: Partial<SyncOptions>,
): Promise<{ deleted: number[]; duration: number; synced: SyncedNoteFile[] }> {
	const startTime = performance.now()

	const resolvedOptions = deepmerge(defaultSyncOptions, options ?? {})
	const { dryRun, modelPrefix } = resolvedOptions

	const allLocalMarkdown: string[] = []
	const allLocalNotes: YankiNote[] = []

	// Use file paths as deck names if they're not provided in the frontmatter
	const deckNamesFromFilePaths = getDeckNamesFromFilePaths(allLocalFilePaths, true)

	for (const [index, filePath] of allLocalFilePaths.entries()) {
		const markdown = await fs.readFile(filePath, 'utf8')
		allLocalMarkdown.push(markdown)
		const note = await getNoteFromMarkdown(markdown, modelPrefix)
		note.deckName ??= deckNamesFromFilePaths[index]
		allLocalNotes.push(note)
	}

	const { deleted, synced } = await syncNotes(allLocalNotes, resolvedOptions)

	// Write IDs to the local files as necessary Can't just get markdown from the
	// note because there might be extra frontmatter from e.g. obsidian, which is
	// not captured in the YankiNote type
	for (const [index, note] of allLocalNotes.entries()) {
		const syncedNoteId = synced[index].note.noteId
		if (note.noteId === undefined || note.noteId !== syncedNoteId) {
			note.noteId = syncedNoteId

			if (note.noteId === undefined) {
				throw new Error('Note ID is still undefined')
			}

			const updatedMarkdown = await setNoteIdInFrontmatter(allLocalMarkdown[index], note.noteId)
			await fs.writeFile(allLocalFilePaths[index], updatedMarkdown)
		}
	}

	const syncedFiles: SyncedNoteFile[] = allLocalNotes.map((note, index) => ({
		action: synced[index].action,
		filePath: allLocalFilePaths[index],
		note,
	}))

	return {
		deleted,
		duration: performance.now() - startTime,
		synced: syncedFiles,
	}
}

/**
 * Helper function to infer deck names from file paths if `deckName` not defined in the note's frontmatter.
 *
 * `deckName` will always override the inferred deck name.
 *
 * Depends on the context of _all_ file paths passed to `syncNoteFiles`.
 *
 * Examples of paths -> deck names with `prune` set to `false`:
 * /base/foo/note.md -> foo
 * /base/foo/baz/note.md -> foo::baz
 * /base/foo/baz/rud/pap/note.md -> foo::baz::rud::pap
 * /base/bla/note.md -> bla
 * /base/bla/note.md -> bla
 * /base/bla/blo/note.md -> bla::blo
 *
 * Examples of paths -> deck names with `prune` set to `true`:
 * /base/foo/note.md -> foo
 * /base/foo/baz/note.md -> foo::baz
 * /base/foo/baz/rud/pap/note.md -> pap
 * /base/bla/note.md -> bla
 * /base/bla/blo/note.md -> bla::blo
 *
 * @param filePaths Paths to all markdown Anki note files
 * @param prune If true, deck names are not allowed to "jump" over empty directories, even if there are other note files somewhere up the hierarchy
 * @returns array of ::-delimited deck paths
 */
function getDeckNamesFromFilePaths(filePaths: string[], prune: boolean) {
	const filePathSegments = filePaths.map((filePath) =>
		path.dirname(path.resolve(filePath)).split(path.sep),
	)

	const deckNames = filePathSegments.map((pathSegments) => {
		if (prune) {
			// Walk right to left, only go as far as you find another file
			// This means "islands" become their own root if there aren't and
			// markdown files in the parent directory
			for (let index = pathSegments.length - 2; index >= 0; index--) {
				// See if the segment is the "last path" in another file
				if (
					!filePathSegments.some(
						(otherPathSegments) => otherPathSegments.at(-1) === pathSegments[index],
					)
				) {
					return pathSegments.slice(index + 1).join('::')
				}
			}
		} else {
			// Walk from left to right, stop when you find the first segment with a file
			for (let index = 0; index < pathSegments.length; index++) {
				if (
					filePathSegments.some(
						(otherPathSegments) => otherPathSegments.at(-1) === pathSegments[index],
					)
				) {
					return pathSegments.slice(index).join('::')
				}
			}
		}

		// If we didn't find another file, return the whole path
		// This should not happen...
		return pathSegments.join('::')
	})

	return deckNames
}

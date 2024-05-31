import { setNoteIdInFrontmatter } from '../model/frontmatter'
import { type YankiNote } from '../model/yanki-note'
import { getNoteFromMarkdown } from '../parse/parse'
import {
	addNote,
	deleteNote,
	deleteNotes,
	deleteOrphanedDecks,
	getRemoteNotes,
	getRemoteNotesById,
	updateNote,
} from './anki-connect'
import { deepmerge } from 'deepmerge-ts'
import fs from 'node:fs/promises'
import path from 'node:path'
import { YankiConnect, type YankiConnectOptions } from 'yanki-connect'

type SyncedNote = {
	action: 'created' | 'deleted' | 'recreated' | 'unchanged' | 'updated'
	note: YankiNote
}

export type SyncOptions = {
	ankiConnectOptions: YankiConnectOptions
	defaultDeckName: string
	dryRun: boolean
	namespace: string
}

const defaultSyncOptions: SyncOptions = {
	ankiConnectOptions: {
		autoLaunch: true,
	},
	defaultDeckName: 'Yanki',
	dryRun: false,
	namespace: 'Yanki CLI',
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
	deletedDecks: string[]
	duration: number
	synced: SyncedNote[]
}> {
	const startTime = performance.now()

	// Defaults
	const { ankiConnectOptions, defaultDeckName, dryRun, namespace } = deepmerge(
		defaultSyncOptions,
		options ?? {},
	)

	// Namespace validation
	const cleanNamespace = namespace.trim()

	if (cleanNamespace === '') {
		throw new Error('Namespace must not be empty')
	}

	if (cleanNamespace.includes('*') || cleanNamespace.includes(':')) {
		throw new Error(`Namespace may not contain the characters '*' or ':'`)
	}

	const synced: SyncedNote[] = []

	const client = new YankiConnect(ankiConnectOptions)

	// Deletion pass, we need the full info to do deck cleanup later on
	const existingRemoteNotes = await getRemoteNotes(client, namespace)
	const orphanedNotes = existingRemoteNotes.filter(
		(remoteNote) => !allLocalNotes.some((localNote) => localNote.noteId === remoteNote?.noteId),
	)

	await deleteNotes(client, orphanedNotes, dryRun)

	for (const orphanedNote of orphanedNotes) {
		synced.push({
			action: 'deleted',
			note: orphanedNote,
		})
	}

	// Set undefined local note decks to the default
	for (const note of allLocalNotes) {
		if (note.deckName === '') {
			console.log('Setting deck name')
			note.deckName = defaultDeckName
		}
	}

	// Set undefined local note IDs to bogus ones to ensure we create them
	const localNoteIds = allLocalNotes.map((note) => note.noteId).map((id) => id ?? -1)
	const remoteNotes = await getRemoteNotesById(client, localNoteIds)

	// Creation and update pass
	for (const [index, remoteNote] of remoteNotes.entries()) {
		const localNote = allLocalNotes[index]

		// Undefined means the note only exists locally
		if (remoteNote === undefined) {
			// Ensure id is undefined, in case the local id is corrupted (e.g. changed
			// by hand)

			const newNoteId = await addNote(client, { ...localNote, noteId: undefined }, dryRun)

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

			synced.push({
				action: 'deleted',
				note: remoteNote,
			})
			await deleteNote(client, remoteNote, dryRun)
			const newNoteId = await addNote(client, { ...localNote, noteId: undefined }, dryRun)

			synced.push({
				action: 'recreated',
				note: {
					...localNote,
					noteId: newNoteId,
				},
			})
		}
	}

	// Purge empty yanki-related decks
	const liveNotes: YankiNote[] = []
	const deletedNotes: YankiNote[] = []
	for (const entry of synced) {
		if (entry.action === 'deleted') {
			deletedNotes.push(entry.note)
		} else {
			liveNotes.push(entry.note)
		}
	}

	const deletedDecks = await deleteOrphanedDecks(client, liveNotes, deletedNotes, dryRun)

	return {
		deletedDecks,
		duration: performance.now() - startTime,
		synced,
	}
}

type SyncedNoteFile = {
	filePath: string | undefined
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
): Promise<{
	deletedDecks: string[]
	duration: number
	synced: SyncedNoteFile[]
}> {
	const startTime = performance.now()

	const resolvedOptions = deepmerge(defaultSyncOptions, options ?? {})
	const { namespace } = resolvedOptions

	const allLocalMarkdown: string[] = []
	const allLocalNotes: YankiNote[] = []

	// Use file paths as deck names if they're not provided in the frontmatter
	const deckNamesFromFilePaths = getDeckNamesFromFilePaths(allLocalFilePaths)

	for (const [index, filePath] of allLocalFilePaths.entries()) {
		const markdown = await fs.readFile(filePath, 'utf8')
		allLocalMarkdown.push(markdown)
		const note = await getNoteFromMarkdown(markdown, namespace)
		if (note.deckName === '') {
			note.deckName = deckNamesFromFilePaths[index]
		}

		allLocalNotes.push(note)
	}

	const { deletedDecks, synced } = await syncNotes(allLocalNotes, resolvedOptions)

	// Write IDs to the local files as necessary Can't just get markdown from the
	// note because there might be extra frontmatter from e.g. obsidian, which is
	// not captured in the YankiNote type

	const liveNotes = synced.filter((note) => note.action !== 'deleted')

	for (const [index, note] of allLocalNotes.entries()) {
		const liveNoteId = liveNotes[index].note.noteId
		if (note.noteId === undefined || note.noteId !== liveNoteId) {
			note.noteId = liveNoteId

			if (note.noteId === undefined) {
				throw new Error('Note ID is still undefined')
			}

			const updatedMarkdown = await setNoteIdInFrontmatter(allLocalMarkdown[index], note.noteId)
			await fs.writeFile(allLocalFilePaths[index], updatedMarkdown)
		}
	}

	const liveFiles: SyncedNoteFile[] = allLocalNotes.map((note, index) => ({
		action: liveNotes[index].action,
		filePath: allLocalFilePaths[index],
		note,
	}))

	// Add undefined file path to deleted notes, since they only ever existed in Anki
	const deletedNotes: SyncedNoteFile[] = synced
		.filter((note) => note.action === 'deleted')
		.map((note) => ({
			action: 'deleted',
			filePath: undefined,
			note: note.note,
		}))

	return {
		deletedDecks,
		duration: performance.now() - startTime,
		synced: [...deletedNotes, ...liveFiles],
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
function getDeckNamesFromFilePaths(
	filePaths: string[],
	mode: 'common' | 'jump' | 'stop' = 'common',
) {
	const filePathSegments = filePaths.map((filePath) =>
		path.dirname(path.resolve(filePath)).split(path.sep),
	)

	// Trim to the shortest common path
	if (mode === 'common') {
		const commonPathSegments = filePathSegments.reduce((acc, pathSegments) => {
			const commonPath = acc.filter((segment, index) => segment === pathSegments[index])
			return commonPath
		})

		const deckNamesWithShortestCommonPath = filePathSegments.map((pathSegments) => {
			const deckName = pathSegments.slice(commonPathSegments.length - 1).join('::')
			return deckName
		})

		return deckNamesWithShortestCommonPath
	}

	// TODO These are kind of broken...

	const deckNames = filePathSegments.map((pathSegments) => {
		// TODO broken if other paths have same file name
		if (mode === 'stop') {
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
		} else if (mode === 'jump') {
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

type CleanOptions = {
	ankiConnectOptions?: YankiConnectOptions
	dryRun: boolean
	namespace: string
}

/**
 * Deletes all remote notes in Anki associated with the given namespace.
 *
 * Use with significant caution. Mostly useful for testing.
 *
 * @returns The IDs of the notes that were deleted
 * @param options
 * @throws
 */
export async function clean(
	options: CleanOptions,
): Promise<{ decks: string[]; notes: YankiNote[] }> {
	const { ankiConnectOptions, dryRun, namespace } = options

	const client = new YankiConnect(ankiConnectOptions)

	const remoteNotes = await getRemoteNotes(client, namespace)

	// Deletion pass
	await deleteNotes(client, remoteNotes, dryRun)
	const deletedDecks = await deleteOrphanedDecks(client, [], remoteNotes, dryRun)

	return {
		decks: deletedDecks,
		notes: remoteNotes,
	}
}

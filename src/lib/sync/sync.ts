import { setNoteIdInFrontmatter } from '../model/frontmatter'
import { type YankiNote, yankiDefaultNamespace } from '../model/yanki-note'
import { getNoteFromMarkdown } from '../parse/parse'
import { environment } from '../utilities/platform'
import { capitalize } from '../utilities/string'
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
import path from 'path-browserify-esm'
import plur from 'plur'
import prettyMilliseconds from 'pretty-ms'
import type { PartialDeep } from 'type-fest'
import { YankiConnect, type YankiConnectOptions, defaultYankiConnectOptions } from 'yanki-connect'

export type SyncedNote = {
	action: 'created' | 'deleted' | 'recreated' | 'unchanged' | 'updated'
	filePath?: string // Not always applicable
	note: YankiNote
}

export type SyncOptions = {
	ankiConnectOptions: YankiConnectOptions
	defaultDeckName: string
	dryRun: boolean
	namespace: string
	/** Ensures that wiki-style links work correctly */
	obsidianVault: string | undefined
}

export const defaultSyncOptions: SyncOptions = {
	ankiConnectOptions: defaultYankiConnectOptions,
	defaultDeckName: 'Yanki',
	dryRun: false,
	namespace: yankiDefaultNamespace,
	obsidianVault: undefined,
}

export type SyncReport = {
	deletedDecks: string[]
	dryRun: boolean
	duration: number
	namespace: string
	synced: SyncedNote[]
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
	options?: PartialDeep<SyncOptions>,
): Promise<SyncReport> {
	const startTime = performance.now()

	// Defaults
	const { ankiConnectOptions, defaultDeckName, dryRun, namespace } = deepmerge(
		defaultSyncOptions,
		options ?? {},
	)

	// Namespace validation
	const validNamespace = namespace.trim()

	if (validNamespace === '') {
		throw new Error('Namespace must not be empty')
	}

	if (validNamespace.includes('*') || validNamespace.includes(':')) {
		throw new Error(`Namespace for sync may not contain the characters '*' or ':'`)
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
		// Same ID, but different namespace, create a new note with a new ID, leave the old one alone
		if (
			remoteNote === undefined ||
			localNote.fields.YankiNamespace !== remoteNote.fields.YankiNamespace
		) {
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
		dryRun,
		duration: performance.now() - startTime,
		namespace,
		synced,
	}
}

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
	options?: PartialDeep<SyncOptions>,
	readFile?: (filePath: string) => Promise<string>,
	writeFile?: (filePath: string, data: string) => Promise<void>,
): Promise<SyncReport> {
	const startTime = performance.now()

	if (readFile === undefined || writeFile === undefined) {
		if (environment === 'node') {
			const fs = await import('node:fs/promises')
			readFile = async (filePath) => fs.readFile(filePath, 'utf8')
			writeFile = async (filePath, data) => fs.writeFile(filePath, data, 'utf8')
		} else {
			throw new Error(
				'Both readFile and writeFile implementations must be provided to the syncFiles function in the browser',
			)
		}
	}

	const resolvedOptions = deepmerge(defaultSyncOptions, options ?? {})
	const { namespace, obsidianVault } = resolvedOptions

	const allLocalMarkdown: string[] = []
	const allLocalNotes: YankiNote[] = []

	// Use file paths as deck names if they're not provided in the frontmatter
	const deckNamesFromFilePaths = getDeckNamesFromFilePaths(allLocalFilePaths)

	for (const [index, filePath] of allLocalFilePaths.entries()) {
		const markdown = await readFile(filePath)
		allLocalMarkdown.push(markdown)
		const note = await getNoteFromMarkdown(markdown, { namespace, obsidianVault })
		if (note.deckName === '') {
			note.deckName = deckNamesFromFilePaths[index]
		}

		allLocalNotes.push(note)
	}

	const { deletedDecks, dryRun, synced } = await syncNotes(allLocalNotes, resolvedOptions)

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
			await writeFile(allLocalFilePaths[index], updatedMarkdown)
		}
	}

	const liveFiles: SyncedNote[] = allLocalNotes.map((note, index) => ({
		action: liveNotes[index].action,
		filePath: allLocalFilePaths[index],
		note,
	}))

	// Add undefined file path to deleted notes, since they only ever existed in Anki
	const deletedNotes: SyncedNote[] = synced
		.filter((note) => note.action === 'deleted')
		.map((note) => ({
			action: 'deleted',
			note: note.note,
		}))

	return {
		deletedDecks,
		dryRun,
		duration: performance.now() - startTime,
		namespace,
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
 * @param absoluteFilePaths Absolute paths to all markdown Anki note files. (Ensures proper resolution if path module is polyfilled.)
 * @param prune If true, deck names are not allowed to "jump" over empty directories, even if there are other note files somewhere up the hierarchy
 * @returns array of ::-delimited deck paths
 */
export function getDeckNamesFromFilePaths(
	absoluteFilePaths: string[],
	mode: 'common' | 'jump' | 'stop' = 'common',
) {
	if (environment === 'node') {
		path.setCWD(process.cwd())
	}

	const filePathSegments = absoluteFilePaths.map((filePath) =>
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

export function formatSyncReport(report: SyncReport, verbose = false): string {
	const lines: string[] = []
	const { synced } = report

	// Aggregate the counts of each action:
	const actionCounts = synced.reduce<Record<string, number>>((acc, note) => {
		acc[note.action] = (acc[note.action] || 0) + 1
		return acc
	}, {})

	const totalSynced = synced.filter((note) => note.action !== 'deleted').length

	lines.push(
		`${report.dryRun ? 'Would have' : 'Successfully'} synced ${totalSynced} ${plur('note', totalSynced)} to Anki${report.dryRun ? '' : ` in ${prettyMilliseconds(report.duration)}`}`,
	)

	if (verbose) {
		lines.push('', report.dryRun ? 'Sync Plan Summary:' : 'Sync Summary:')
		for (const [action, count] of Object.entries(actionCounts)) {
			lines.push(`  ${capitalize(action)}: ${count}`)
		}

		if (report.deletedDecks.length > 0) {
			lines.push('', `Decks pruned: ${report.deletedDecks.length}`)
		}

		lines.push('', report.dryRun ? 'Sync Plan Details:' : 'Sync Details:')
		for (const { action, filePath, note } of synced) {
			if (filePath === undefined) {
				lines.push(`  Note ID ${note.noteId} ${capitalize(action)} (From Anki)`)
			} else {
				lines.push(`  Note ID ${note.noteId} ${capitalize(action)} ${filePath}`)
			}
		}
	}

	return lines.join('\n')
}

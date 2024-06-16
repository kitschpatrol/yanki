import { yankiDefaultNamespace, yankiSyncToAnkiWebEvenIfUnchanged } from '../model/constants'
import { setNoteIdInFrontmatter } from '../model/frontmatter'
import { type YankiNote } from '../model/note'
import {
	addNote,
	deleteNote,
	deleteNotes,
	deleteOrphanedDecks,
	getRemoteNotes,
	getRemoteNotesById,
	requestPermission,
	updateNote,
} from '../utilities/anki-connect'
import { validateFileFunctions } from '../utilities/file'
import { capitalize } from '../utilities/string'
import { renameFiles } from './rename'
import { deepmerge } from 'deepmerge-ts'
import plur from 'plur'
import prettyMilliseconds from 'pretty-ms'
import type { PartialDeep } from 'type-fest'
import { YankiConnect, type YankiConnectOptions, defaultYankiConnectOptions } from 'yanki-connect'

export type SyncedNote = {
	action: 'ankiUnreachable' | 'created' | 'deleted' | 'recreated' | 'unchanged' | 'updated'
	filePath?: string // Not always applicable
	filePathOriginal?: string // Not always applicable, used to detect name changes
	note: YankiNote
}

export type SyncOptions = {
	ankiConnectOptions: YankiConnectOptions
	/**
	 * Automatically sync any changes to AnkiWeb after Yanki has finished syncing
	 * locally. If false, only local Anki data is updated and you must manually
	 * invoke a sync to AnkiWeb. This is the equivalent of pushing the "sync"
	 * button in the Anki app.
	 */
	ankiWeb: boolean
	defaultDeckName: string
	dryRun: boolean
	/** Only applies to syncFiles */
	manageFilenames: 'off' | 'prompt' | 'response'
	/** Only applies if manageFilenames is not `'off'`. Will _not_ truncate user-specified file names in other cases. */
	maxFilenameLength: number
	namespace: string
	/** Ensures that wiki-style links work correctly */
	obsidianVault: string | undefined
}

export const defaultSyncOptions: SyncOptions = {
	ankiConnectOptions: defaultYankiConnectOptions,
	ankiWeb: false,
	defaultDeckName: 'Yanki',
	dryRun: false,
	manageFilenames: 'off',
	maxFilenameLength: 60,
	namespace: yankiDefaultNamespace,
	obsidianVault: undefined,
}

export type SyncReport = {
	ankiWeb: boolean
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
// eslint-disable-next-line complexity
export async function syncNotes(
	allLocalNotes: YankiNote[],
	options?: PartialDeep<SyncOptions>,
): Promise<SyncReport> {
	const startTime = performance.now()

	// Defaults
	const { ankiConnectOptions, ankiWeb, defaultDeckName, dryRun, namespace } = deepmerge(
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

	const permissionStatus = await requestPermission(client)

	if (permissionStatus === 'ankiUnreachable') {
		return {
			ankiWeb,
			deletedDecks: [],
			dryRun,
			duration: performance.now() - startTime,
			namespace,
			synced: allLocalNotes.map((note) => ({
				action: 'ankiUnreachable',
				filePath: undefined,
				filePathOriginal: undefined,
				note,
			})),
		}
	}

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

	// Check for and handle duplicate local note ids...
	// If there are multiple local notes with the same ID, we see if any of them
	// has content matching its remote note. If so, we keep that one and create
	// new notes for the others by setting their noteIds to undefined. This is
	// an edge case, but it can happen if users are manually duplicating notes
	// that have already been synced as a shortcut to create new ones.
	// Can't really think of a more sane thing to do without access to file metadata.
	for (const localNote of allLocalNotes) {
		if (localNote.noteId === undefined) continue

		const duplicates = findNotesWithDuplicateIds(allLocalNotes, localNote.noteId)

		if (duplicates.length <= 1) continue

		const remoteNote = existingRemoteNotes.find((remote) => remote?.noteId === localNote.noteId)

		// Defaults to the first note if no content match is found
		const noteToKeep = selectNoteToKeep(duplicates, remoteNote)

		// Reset noteId for all duplicates except the one to keep
		for (const duplicate of duplicates) {
			if (duplicate !== noteToKeep) {
				duplicate.noteId = undefined
			}
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

	const deletedDecks = await deleteOrphanedDecks(client, liveNotes, existingRemoteNotes, dryRun)

	// AnkiWeb sync
	const isChanged = deletedDecks.length > 0 || synced.some((note) => note.action !== 'unchanged')
	if (!dryRun && ankiWeb && (isChanged || yankiSyncToAnkiWebEvenIfUnchanged)) {
		await client.miscellaneous.sync()
	}

	return {
		ankiWeb,
		deletedDecks,
		dryRun,
		duration: performance.now() - startTime,
		namespace,
		synced,
	}
}

/**
 * Sync a list of local yanki files to Anki.
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
	rename?: (oldPath: string, newPath: string) => Promise<void>,
): Promise<SyncReport> {
	const startTime = performance.now()

	const {
		readFile: readFileValidated,
		rename: renameValidated,
		writeFile: writeFileValidated,
	} = await validateFileFunctions(readFile, writeFile, rename)

	const resolvedOptions = deepmerge(defaultSyncOptions, options ?? {})
	const { namespace } = resolvedOptions

	const { notes: loadedAndRenamedNotes } = await renameFiles(
		allLocalFilePaths,
		resolvedOptions,
		readFileValidated,
		writeFileValidated,
		renameValidated,
	)

	const allLocalNotes = loadedAndRenamedNotes.map((note) => note.note)

	const { ankiWeb, deletedDecks, dryRun, synced } = await syncNotes(allLocalNotes, resolvedOptions)

	// Write IDs to the local files as necessary
	// Can't just get markdown from the note because there might be extra
	// frontmatter from e.g. obsidian, which is not captured in the YankiNote type
	const liveNotes = synced.filter((note) => note.action !== 'deleted')

	for (const [index, loadedAndRenamedNote] of loadedAndRenamedNotes.entries()) {
		const liveNote = liveNotes[index]

		if (
			(loadedAndRenamedNote.note.noteId === undefined ||
				loadedAndRenamedNote.note.noteId !== liveNote.note.noteId) &&
			liveNote.action !== 'ankiUnreachable'
		) {
			const updatedMarkdown = await setNoteIdInFrontmatter(
				loadedAndRenamedNote.markdown,
				liveNote.note.noteId,
			)
			await writeFileValidated(loadedAndRenamedNote.filePath, updatedMarkdown)
		}

		// Set file paths
		liveNote.filePath = loadedAndRenamedNote.filePath
		liveNote.filePathOriginal = loadedAndRenamedNote.filePathOriginal
	}

	// Add undefined file paths to deleted notes, since they only ever existed in Anki
	const deletedNotes: SyncedNote[] = synced
		.filter((note) => note.action === 'deleted')
		.map((note) => ({
			action: 'deleted',
			note: note.note,
		}))

	const syncedAndSorted = [...deletedNotes, ...liveNotes].sort((a, b) =>
		(a.filePath ?? '').localeCompare(b.filePath ?? ''),
	)

	return {
		ankiWeb,
		deletedDecks,
		dryRun,
		duration: performance.now() - startTime,
		namespace,
		synced: syncedAndSorted,
	}
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
	const totalRenamed = synced.filter((note) => note.filePath !== note.filePathOriginal).length
	const ankiUnreachable = actionCounts.ankiUnreachable > 0

	lines.push(
		`${report.dryRun ? 'Will sync' : ankiUnreachable ? 'Failed to sync' : 'Successfully synced'} synced ${totalSynced} ${plur('note', totalSynced)} to Anki${report.dryRun ? '' : ` in ${prettyMilliseconds(report.duration)}`}.`,
	)

	if (verbose) {
		lines.push('', report.dryRun ? 'Sync Plan Summary:' : 'Sync Summary:')
		for (const [action, count] of Object.entries(actionCounts)) {
			lines.push(`  ${capitalize(action)}: ${count}`)
		}

		if (totalRenamed > 0) {
			lines.push('', `Local notes renamed: ${totalRenamed}`)
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

// Helper function to find notes with the same noteId
function findNotesWithDuplicateIds(notes: YankiNote[], noteId: number): YankiNote[] {
	return notes.filter((note) => (note.noteId === undefined ? false : note.noteId === noteId))
}

// Function to select the note to keep based on content matching with the remote note
function selectNoteToKeep(duplicates: YankiNote[], remoteNote: YankiNote | undefined): YankiNote {
	return (
		duplicates.find(
			(duplicate) =>
				duplicate.fields.Front === remoteNote?.fields.Front &&
				duplicate.fields.Back === remoteNote?.fields.Back,
		) ?? duplicates[0] // Default to the first note if no content match is found
	)
}

import type { PartialDeep, Simplify } from 'type-fest'
import { deepmerge } from 'deepmerge-ts'
import { YankiConnect } from 'yanki-connect'
import { type YankiNote } from '../model/note'
import { NOTE_DEFAULT_DECK_NAME, SYNC_TO_ANKI_WEB_EVEN_IF_UNCHANGED } from '../shared/constants'
import { defaultGlobalOptions, type GlobalOptions } from '../shared/types'
import {
	addNote,
	deleteNotes,
	deleteOrphanedDecks,
	deleteUnusedMedia,
	getRemoteNotes,
	getRemoteNotesById,
	requestPermission,
	syncToAnkiWeb,
	updateNote,
} from '../utilities/anki-connect'
import { validateAndSanitizeNamespace } from '../utilities/namespace'

export type SyncedNote = {
	note: YankiNote
}

export type SyncNotesOptions = Pick<
	GlobalOptions,
	'ankiConnectOptions' | 'ankiWeb' | 'dryRun' | 'namespace'
>

export const defaultSyncNotesOptions: SyncNotesOptions = {
	...defaultGlobalOptions,
}

export type SyncNotesResult = Simplify<
	{
		deletedDecks: string[]
		deletedMedia: string[]
		duration: number
		synced: SyncedNote[]
	} & Pick<GlobalOptions, 'ankiWeb' | 'dryRun' | 'namespace'>
>

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
	options?: PartialDeep<SyncNotesOptions>,
): Promise<SyncNotesResult> {
	const startTime = performance.now()

	// Defaults
	const { ankiConnectOptions, ankiWeb, dryRun, namespace } = deepmerge(
		defaultSyncNotesOptions,
		options ?? {},
	) as SyncNotesOptions

	const sanitizedNamespace = validateAndSanitizeNamespace(namespace)

	const synced: SyncedNote[] = []

	const client = new YankiConnect(ankiConnectOptions)

	const permissionStatus = await requestPermission(client)

	if (permissionStatus === 'ankiUnreachable') {
		return {
			ankiWeb,
			deletedDecks: [],
			deletedMedia: [],
			dryRun,
			duration: performance.now() - startTime,
			namespace: sanitizedNamespace,
			synced: allLocalNotes.map((note) => ({
				action: 'ankiUnreachable',
				note,
			})),
		}
	}

	// Deletion pass, we need the full info to do deck cleanup later on
	const existingRemoteNotes = await getRemoteNotes(client, sanitizedNamespace)

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
			note.deckName = NOTE_DEFAULT_DECK_NAME
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
		} else {
			// Update remote notes if they differ
			// TODO can this ever happen?
			if (remoteNote.noteId === undefined) {
				throw new Error('Remote note ID is undefined')
			}

			// Also handles model updates
			const wasUpdated = await updateNote(client, localNote, remoteNote, dryRun)

			synced.push({
				action: wasUpdated ? 'updated' : 'unchanged',
				note: localNote,
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

	// Clean up unused media files
	const deletedMedia = await deleteUnusedMedia(client, liveNotes, sanitizedNamespace, dryRun)

	// AnkiWeb sync
	const isChanged = deletedDecks.length > 0 || synced.some((note) => note.action !== 'unchanged')
	if (!dryRun && ankiWeb && (isChanged || SYNC_TO_ANKI_WEB_EVEN_IF_UNCHANGED)) {
		await syncToAnkiWeb(client)
	}

	return {
		ankiWeb,
		deletedDecks,
		deletedMedia,
		dryRun,
		duration: performance.now() - startTime,
		namespace: sanitizedNamespace,
		synced,
	}
}

// Helper function to find notes with the same noteId
function findNotesWithDuplicateIds(notes: YankiNote[], noteId: number): YankiNote[] {
	return notes.filter((note) => (note.noteId === undefined ? false : note.noteId === noteId))
}

// Function to select the note to keep based on content matching with the remote note
function selectNoteToKeep(duplicates: YankiNote[], remoteNote: undefined | YankiNote): YankiNote {
	return (
		duplicates.find(
			(duplicate) =>
				duplicate.fields.Front === remoteNote?.fields.Front &&
				duplicate.fields.Back === remoteNote?.fields.Back,
		) ?? duplicates[0] // Default to the first note if no content match is found
	)
}

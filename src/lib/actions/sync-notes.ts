import type { PartialDeep, Simplify } from 'type-fest'
import { deepmerge } from 'deepmerge-ts'
import { YankiConnect } from 'yanki-connect'
import type { YankiNote } from '../model/note'
import type { GlobalOptions } from '../shared/types'
import { NOTE_DEFAULT_DECK_NAME, SYNC_TO_ANKI_WEB_EVEN_IF_UNCHANGED } from '../shared/constants'
import { defaultGlobalOptions } from '../shared/types'
import {
	addNote,
	areNotesEqual,
	deleteNotes,
	deleteOrphanedDecks,
	deleteUnusedMedia,
	getRemoteNotes,
	requestPermission,
	syncToAnkiWeb,
	updateNote,
} from '../utilities/anki-connect'
import { validateAndSanitizeNamespace } from '../utilities/namespace'

export type SyncedNote = {
	action: 'ankiUnreachable' | 'created' | 'deleted' | 'matched' | 'unchanged' | 'updated'
	note: YankiNote
}

export type SyncNotesOptions = Pick<
	GlobalOptions,
	'ankiConnectOptions' | 'ankiWeb' | 'checkDatabase' | 'dryRun' | 'namespace' | 'strictMatching'
>

export const defaultSyncNotesOptions: SyncNotesOptions = {
	...defaultGlobalOptions,
}

export type SyncNotesResult = Simplify<
	Pick<GlobalOptions, 'ankiWeb' | 'dryRun' | 'namespace'> & {
		deletedDecks: string[]
		deletedMedia: string[]
		duration: number
		fixedDatabase: boolean
		synced: SyncedNote[]
	}
>

/**
 * Syncs local notes to Anki.
 * @param allLocalNotes All the YankiNotes to sync
 * @returns The synced notes (with new IDs where applicable), plus some stats
 * about the sync
 * @throws {Error} For various reasons...
 */
// eslint-disable-next-line complexity
export async function syncNotes(
	allLocalNotes: YankiNote[],
	options?: PartialDeep<SyncNotesOptions>,
): Promise<SyncNotesResult> {
	const startTime = performance.now()

	// Don't leak mutations to the notes
	const allLocalNotesCopy = structuredClone(allLocalNotes)

	// Defaults
	const { ankiConnectOptions, ankiWeb, checkDatabase, dryRun, namespace, strictMatching } =
		deepmerge(defaultSyncNotesOptions, options ?? {}) as SyncNotesOptions

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
			fixedDatabase: false,
			namespace: sanitizedNamespace,
			synced: allLocalNotesCopy.map((note) => ({
				action: 'ankiUnreachable',
				note,
			})),
		}
	}

	// Set undefined local note decks to the default
	for (const localNote of allLocalNotesCopy) {
		if (localNote.deckName === '') {
			localNote.deckName = NOTE_DEFAULT_DECK_NAME
		}
	}

	// Get all remote notes in any namespace
	const allRemoteNotes = await getRemoteNotes(client, '*')
	const remoteNotes = allRemoteNotes.filter(
		(remoteNote) => remoteNote.fields.YankiNamespace === sanitizedNamespace,
	)

	// Clear duplicate local note IDs
	// Duplicate pass, multiple local notes with the same noteId
	// Check for and handle duplicate local note ids...
	// If there are multiple local notes with the same ID, we see if any of them
	// has content matching its remote note. If so, we keep that one and create
	// new notes for the others by setting their noteIds to undefined. This is
	// an edge case, but it can happen if users are manually duplicating notes
	// that have already been synced as a shortcut to create new ones.
	// Can't really think of a more sane thing to do without access to file metadata.
	for (const localNote of allLocalNotesCopy) {
		if (localNote.noteId === undefined) continue

		const duplicates = findNotesWithDuplicateIds(allLocalNotesCopy, localNote.noteId)

		if (duplicates.length <= 1) continue

		const remoteNote = remoteNotes.find((remote) => remote.noteId === localNote.noteId)

		// Defaults to the first note if no content match is found
		const noteToKeep = selectNoteToKeep(duplicates, remoteNote)

		// Reset noteId in allLocalNotes for all duplicates except the one to keep
		for (const duplicate of duplicates) {
			if (duplicate !== noteToKeep) {
				duplicate.noteId = undefined
			}
		}
	}

	const matchedIds = new Set<number>(
		allLocalNotesCopy
			.filter(
				(localNote) =>
					localNote.noteId !== undefined &&
					remoteNotes.some((remote) => localNote.noteId === remote.noteId),
			)
			.map((note) => note.noteId!),
	)

	// Main sync pass
	for (const localNote of allLocalNotesCopy) {
		let remoteNote = allRemoteNotes.find((remote) => remote.noteId === localNote.noteId)

		// Handle notes with the same ID in different namespaces
		if (remoteNote?.fields.YankiNamespace !== sanitizedNamespace) {
			// Reset local note id, will be recreated...
			localNote.noteId = undefined
			remoteNote = undefined
		}

		// Find matching remote note if it exists
		if (remoteNote === undefined) {
			localNote.noteId = strictMatching
				? undefined
				: findRemoteContentMatchId(localNote, remoteNotes, matchedIds)

			if (localNote.noteId === undefined) {
				// No match means it's a new note
				localNote.noteId = await addNote(client, { ...localNote, noteId: undefined }, dryRun)
				synced.push({
					action: 'created',
					note: localNote,
				})
			} else {
				// Match note
				synced.push({
					action: 'matched',
					note: localNote,
				})
			}
		} else {
			// Update remote notes if they differ
			if (remoteNote.noteId === undefined) {
				// Should be unreachable
				throw new Error('Remote note ID is undefined')
			}

			// Also handles model updates
			const wasUpdated = await updateNote(client, localNote, remoteNote, dryRun)

			synced.push({
				action: wasUpdated ? 'updated' : 'unchanged',
				note: localNote,
			})
		}

		if (localNote.noteId === undefined) {
			// Should be unreachable
			throw new Error('Note ID is undefined')
		}

		matchedIds.add(localNote.noteId)
	}

	// Deletion pass, we need the full info to do deck cleanup later on
	// TODO does strictMatching have implications here?
	const orphanedNotes = remoteNotes.filter(
		(remoteNote) => !allLocalNotesCopy.some((localNote) => localNote.noteId === remoteNote.noteId),
	)

	await deleteNotes(client, orphanedNotes, dryRun)
	for (const orphanedNote of orphanedNotes) {
		synced.push({
			action: 'deleted',
			note: orphanedNote,
		})
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

	const deletedDecks = await deleteOrphanedDecks(client, liveNotes, remoteNotes, dryRun)

	let fixedDatabase = false
	if (checkDatabase) {
		// Check for database corruption
		// (can happen if a model update changes a card count for a note)
		const updatedModelRemoteNotes = remoteNotes.filter((remoteNote) =>
			synced.some(
				(localNote) =>
					localNote.action === 'updated' &&
					// TODO does strictMatching have implications here?
					localNote.note.noteId === remoteNote.noteId &&
					localNote.note.modelName !== remoteNote.modelName,
			),
		)

		if (updatedModelRemoteNotes.length > 0) {
			const cardIdsToCheck: number[] = updatedModelRemoteNotes.flatMap(({ cards }) => cards ?? [])

			// TODO: Is the miscellaneous.reloadCollection() a better option?
			try {
				// This will throw a template error if there are bad cards...
				await client.card.cardsInfo({ cards: cardIdsToCheck })
			} catch {
				fixedDatabase = true
				await client.graphical.guiCheckDatabase()
			}
		}
	}

	// Clean up unused media files
	const deletedMedia = await deleteUnusedMedia(client, liveNotes, sanitizedNamespace, dryRun)

	// AnkiWeb sync
	const isChanged = deletedDecks.length > 0 || synced.some((note) => note.action !== 'unchanged')
	// eslint-disable-next-line ts/no-unnecessary-condition
	if (!dryRun && ankiWeb && (isChanged || SYNC_TO_ANKI_WEB_EVEN_IF_UNCHANGED)) {
		await syncToAnkiWeb(client)
	}

	return {
		ankiWeb,
		deletedDecks,
		deletedMedia,
		dryRun,
		duration: performance.now() - startTime,
		fixedDatabase,
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
				duplicate.fields.Back === remoteNote.fields.Back &&
				duplicate.fields.Extra === remoteNote.fields.Extra,
		) ?? duplicates[0] // Default to the first note if no content match is found
	)
}

function findRemoteContentMatchId(
	localNote: YankiNote,
	remoteNotes: YankiNote[],
	matchedIds: Set<number>,
): number | undefined {
	const match = remoteNotes.find(
		(remoteNote) =>
			remoteNote.noteId !== undefined &&
			!matchedIds.has(remoteNote.noteId) &&
			areNotesEqual(localNote, remoteNote, false),
	)
	return match?.noteId ?? undefined
}

import type { PartialDeep, Simplify } from 'type-fest'
import { deepmerge } from 'deepmerge-ts'
import { YankiConnect } from 'yanki-connect'
import type { YankiNote } from '../model/note'
import type { GlobalOptions } from '../shared/types'
import { NOTE_DEFAULT_DECK_NAME, SYNC_TO_ANKI_WEB_EVEN_IF_UNCHANGED } from '../shared/constants'
import { defaultGlobalOptions } from '../shared/types'
import {
	areNotesEqual,
	deleteNotes,
	deleteOrphanedDecks,
	ensureModelsAndDecks,
	executeCreates,
	executeUpdates,
	getRemoteNotes,
	reconcileMedia,
	requestPermission,
	syncToAnkiWeb,
} from '../utilities/anki-connect'
import { validateAndSanitizeNamespace } from '../utilities/namespace'

export type SyncedNote = {
	action: 'ankiUnreachable' | 'created' | 'deleted' | 'matched' | 'unchanged' | 'updated'
	note: YankiNote
}

export type SyncNotesOptions = Pick<
	GlobalOptions,
	| 'ankiConnectOptions'
	| 'ankiWeb'
	| 'checkDatabase'
	| 'dryRun'
	| 'fileAdapter'
	| 'namespace'
	| 'strictMatching'
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
		reuploadedMedia: string[]
		synced: SyncedNote[]
	}
>

/**
 * Syncs local notes to Anki.
 *
 * @param allLocalNotes All the YankiNotes to sync
 *
 * @returns The synced notes (with new IDs where applicable), plus some stats
 *   about the sync
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
	const {
		ankiConnectOptions,
		ankiWeb,
		checkDatabase,
		dryRun,
		fileAdapter,
		namespace,
		strictMatching,
	} = deepmerge(defaultSyncNotesOptions, options ?? {}) as SyncNotesOptions

	const sanitizedNamespace = validateAndSanitizeNamespace(namespace)

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
			reuploadedMedia: [],
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
		if (localNote.noteId === undefined) {
			continue
		}

		const duplicates = findNotesWithDuplicateIds(allLocalNotesCopy, localNote.noteId)

		if (duplicates.length <= 1) {
			continue
		}

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

	// Classify notes into create/update/matched buckets without mutating Anki
	// state. Pure JS — preserves the iteration-order dependency on `matchedIds`.
	const plan = classifyNotes(
		allLocalNotesCopy,
		allRemoteNotes,
		remoteNotes,
		sanitizedNamespace,
		strictMatching,
	)

	// Pre-create any missing models/decks so the batched calls don't need
	// per-action recovery from "model not found" or "deck not found".
	await ensureModelsAndDecks(client, plan.modelsNeeded, plan.decksNeeded, dryRun)

	// Single batched `addNotes` call — 5.85× faster than the sequential
	// `addNote` loop on the established benchmark.
	await executeCreates(client, plan.toCreate, dryRun)

	// Bundle `changeDeck` and `updateNoteModel` actions into one `multi()`
	// request, then surface any per-action errors. Returns the indices of
	// notes that ended up unchanged so we can downgrade their placeholder
	// `'updated'` action below.
	const unchangedSyncedIndices = await executeUpdates(client, plan.toUpdate, dryRun)

	for (const syncedIndex of unchangedSyncedIndices) {
		plan.synced[syncedIndex] = { action: 'unchanged', note: plan.synced[syncedIndex].note }
	}

	const { synced } = plan

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
			// Model changes can leave orphaned cards in the database.
			// Always run a database check to clean them up, since the
			// behavior of cardsInfo on stale card IDs is platform-dependent?
			// fixedDatabase = true
			// await client.graphical.guiCheckDatabase()

			const cardIdsToCheck: number[] = updatedModelRemoteNotes.flatMap(({ cards }) => cards ?? [])
			try {
				// This will throw a template error if there are bad cards...
				await client.card.cardsInfo({ cards: cardIdsToCheck })
			} catch {
				fixedDatabase = true
				await client.graphical.guiCheckDatabase()
				// Windows needed this as well
				await client.miscellaneous.reloadCollection()
			}
		}
	}

	// Media: collect across all live notes, diff against what's in Anki, then
	// upload missing and delete orphaned in batched `multi()` chunks. Notes
	// that we just created or updated this sync go through the silent-upload
	// path so the returned `reuploaded` list keeps its prior meaning ("media
	// we restored for notes that should already have had it").
	const freshWriteNoteIds = new Set<number>()
	for (const entry of synced) {
		if (
			(entry.action === 'created' || entry.action === 'updated') &&
			entry.note.noteId !== undefined
		) {
			freshWriteNoteIds.add(entry.note.noteId)
		}
	}

	const { deleted: deletedMedia, reuploaded: reuploadedMedia } = await reconcileMedia(
		client,
		liveNotes,
		sanitizedNamespace,
		dryRun,
		fileAdapter ?? undefined,
		freshWriteNoteIds,
	)

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
		reuploadedMedia,
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

type CreateBucketEntry = { localNote: YankiNote; syncedIndex: number }
type UpdateBucketEntry = { localNote: YankiNote; remoteNote: YankiNote; syncedIndex: number }

type SyncPlan = {
	decksNeeded: string[]
	modelsNeeded: string[]
	synced: SyncedNote[]
	toCreate: CreateBucketEntry[]
	toUpdate: UpdateBucketEntry[]
}

/**
 * Walk the local notes once and partition them into create / update / matched
 * buckets without touching Anki. The classification preserves the original
 * iteration-order dependency on `matchedIds` so subsequent content-match
 * lookups behave identically to the legacy interleaved loop.
 *
 * `synced` is pre-populated at the input index for every note so the final
 * order of the returned `synced` array mirrors `allLocalNotesCopy`. Update
 * entries start with action `'updated'` as a placeholder; the caller downgrades
 * them to `'unchanged'` after `updateNote` reports no diff.
 */
function classifyNotes(
	allLocalNotesCopy: YankiNote[],
	allRemoteNotes: YankiNote[],
	remoteNotes: YankiNote[],
	sanitizedNamespace: string,
	strictMatching: boolean,
): SyncPlan {
	const toCreate: CreateBucketEntry[] = []
	const toUpdate: UpdateBucketEntry[] = []
	const synced: SyncedNote[] = []
	const modelsNeeded = new Set<string>()
	const decksNeeded = new Set<string>()

	const matchedIds = new Set<number>(
		allLocalNotesCopy
			.filter(
				(localNote) =>
					localNote.noteId !== undefined &&
					remoteNotes.some((remote) => localNote.noteId === remote.noteId),
			)
			.map((note) => note.noteId!),
	)

	for (const localNote of allLocalNotesCopy) {
		let remoteNote = allRemoteNotes.find((remote) => remote.noteId === localNote.noteId)

		// Note with the same ID lives in a different namespace — treat as new.
		if (remoteNote?.fields.YankiNamespace !== sanitizedNamespace) {
			localNote.noteId = undefined
			remoteNote = undefined
		}

		const syncedIndex = synced.length

		if (remoteNote === undefined) {
			localNote.noteId = strictMatching
				? undefined
				: findRemoteContentMatchId(localNote, remoteNotes, matchedIds)

			if (localNote.noteId === undefined) {
				synced.push({ action: 'created', note: localNote })
				toCreate.push({ localNote, syncedIndex })
				modelsNeeded.add(localNote.modelName)
				decksNeeded.add(localNote.deckName)
			} else {
				synced.push({ action: 'matched', note: localNote })
				matchedIds.add(localNote.noteId)
			}
		} else {
			if (remoteNote.noteId === undefined) {
				// Should be unreachable
				throw new Error('Remote note ID is undefined')
			}

			synced.push({ action: 'updated', note: localNote })
			toUpdate.push({ localNote, remoteNote, syncedIndex })
			modelsNeeded.add(localNote.modelName)
			decksNeeded.add(localNote.deckName)
			matchedIds.add(remoteNote.noteId)
		}
	}

	return {
		decksNeeded: [...decksNeeded],
		modelsNeeded: [...modelsNeeded],
		synced,
		toCreate,
		toUpdate,
	}
}

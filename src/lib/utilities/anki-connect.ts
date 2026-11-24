/* eslint-disable max-depth */
/* eslint-disable ts/no-unnecessary-condition */
/* eslint-disable jsdoc/require-jsdoc */

import type { YankiConnect } from 'yanki-connect'
import { uint8ArrayToBase64 } from 'uint8array-extras'
import { AnkiConnectUnreachableError } from 'yanki-connect'
import type { YankiModelName } from '../model/model'
import type { YankiNote } from '../model/note'
import type { Media } from '../parse/rehype-utilities'
import type { FileAdapter } from '../shared/types'
import { legacyYankiModelNames, yankiModelNames, yankiModels } from '../model/model'
import { extractMediaFromHtml } from '../parse/rehype-utilities'
import { defaultGlobalOptions } from '../shared/types'
import { getSlugifiedNamespace } from './namespace'
import { isUrl } from './url'

const MODEL_EXISTS_ERROR = 'Model name already exists'

async function ensureModelExists(
	client: YankiConnect,
	model: (typeof yankiModels)[number],
): Promise<void> {
	try {
		await client.model.createModel(model)
	} catch (error) {
		if (error instanceof Error && error.message === MODEL_EXISTS_ERROR) {
			return
		}

		throw error
	}
}

export async function deleteNotes(client: YankiConnect, notes: YankiNote[], dryRun = false) {
	if (dryRun) {
		return
	}

	const noteIds = notes.map((note) => note.noteId).filter((noteId) => noteId !== undefined)
	if (noteIds.length === 0) {
		return
	}

	await client.note.deleteNotes({ notes: noteIds })
}

/**
 * Ensure that every required Yanki model and deck exists in Anki before any
 * note add/update calls fire, so the batched calls never have to recover from a
 * missing model or deck.
 *
 * @throws {Error} If a required model name is not a known Yanki model, or if a
 *   deck name is empty.
 */
export async function ensureModelsAndDecks(
	client: YankiConnect,
	modelNames: string[],
	deckNames: string[],
	dryRun: boolean,
): Promise<void> {
	if (deckNames.includes('')) {
		throw new Error('Deck name is empty')
	}

	if (dryRun) {
		return
	}

	const [modelsResponse, decksResponse] = await sendMulti(client, [
		{ action: 'modelNames', version: 6 },
		{ action: 'deckNames', version: 6 },
	])
	const existingModels = new Set(
		toStringArray(getMultiResult(modelsResponse, 'modelNames'), 'modelNames'),
	)
	const existingDecks = new Set(
		toStringArray(getMultiResult(decksResponse, 'deckNames'), 'deckNames'),
	)
	const missingDecks = new Set(deckNames).difference(existingDecks)
	const missingModels = Array.from(new Set(modelNames).difference(existingModels), (modelName) => {
		const model = yankiModels.find((candidate) => candidate.modelName === modelName)
		if (model === undefined) {
			throw new Error(`Unknown model name: ${modelName}`)
		}

		return model
	})

	// Every missing model and deck is created in one request, however many
	// there are
	const creationActions: MultiAction[] = [
		...missingModels.map((model): MultiAction => ({
			action: 'createModel',
			params: model,
			version: 6,
		})),
		...Array.from(missingDecks, (deck): MultiAction => ({
			action: 'createDeck',
			params: { deck },
			version: 6,
		})),
	]
	const createdNames = [...missingModels.map((model) => model.modelName), ...missingDecks]

	await runMultiInChunks(
		client,
		creationActions,
		(index, { error }) => {
			const action = creationActions[index]?.action
			// Another sync may create the model between the probe and this request
			if (error === null || (action === 'createModel' && error === MODEL_EXISTS_ERROR)) {
				return
			}

			throw new Error(`${action} failed for "${createdNames[index]}": ${error}`)
		},
		Infinity,
	)
}

/**
 * Unwrap the result of one action from a `multi()` reply.
 *
 * @throws {Error} If the action has no response or returned an error.
 */
function getMultiResult(response: MultiActionResponse | undefined, actionName: string): unknown {
	if (response === undefined) {
		throw new Error(`multi() returned no response for ${actionName}`)
	}

	if (response.error !== null) {
		throw new Error(`${actionName} failed: ${response.error}`)
	}

	return response.result
}

/**
 * Narrow a `multi()` action result to `string[]`. The yanki-connect typing
 * leaves the result as a loose union of every possible response shape, so we
 * verify at runtime that the action returned what we expect.
 */
function toStringArray(value: unknown, actionName: string): string[] {
	if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
		return value
	}

	throw new TypeError(`Expected string[] from ${actionName}, got: ${JSON.stringify(value)}`)
}

/**
 * Narrow a `multi()` action result to `number[]`. Mirror of `toStringArray` for
 * `findNotes`-style responses.
 */
function toNumberArray(value: unknown, actionName: string): number[] {
	if (Array.isArray(value) && value.every((entry) => typeof entry === 'number')) {
		return value
	}

	throw new TypeError(`Expected number[] from ${actionName}, got: ${JSON.stringify(value)}`)
}

/**
 * Short, user-readable identifier for a note in error messages — preferring
 * `noteId` when present (updates), falling back to a Front-field preview
 * (creates). Lets users map a batch failure back to a source file without
 * counting indices.
 */
function describeNote(note: YankiNote): string {
	if (note.noteId !== undefined) {
		return `noteId ${note.noteId}`
	}

	const front = note.fields.Front.replaceAll(/\s+/gu, ' ').trim()
	const preview = front.length > 60 ? `${front.slice(0, 57)}...` : front
	return preview === '' ? '(empty Front field)' : `front "${preview}"`
}

/**
 * Create a batch of notes via `addNotes`, split into as few requests as the
 * request size budget allows. Mutates `localNote.noteId` on each entry as Anki
 * assigns IDs.
 *
 * Pre-flighted models/decks (see `ensureModelsAndDecks`) make this the only
 * write to Anki for note creation — no per-note retry on missing model/deck.
 * Media is handled separately by `reconcileMedia` after the full sync pass.
 *
 * The AnkiConnect releases Yanki is tested against fail the whole request when
 * a note can't be created. A null entry is treated as a failed note as well, in
 * case a release reports failures per note instead.
 *
 * @throws {Error} If `addNotes` returns a different number of IDs than notes
 *   sent, or null entries for any note. Notes in requests that succeeded keep
 *   their assigned IDs.
 */
export async function executeCreates(
	client: YankiConnect,
	toCreate: Array<{ localNote: YankiNote }>,
	dryRun: boolean,
): Promise<void> {
	if (toCreate.length === 0) {
		return
	}

	if (dryRun) {
		for (const { localNote } of toCreate) {
			localNote.noteId = 0
		}

		return
	}

	const failedDescriptions: string[] = []
	let noteIndex = 0
	for (const chunk of chunkForRequest(toCreate)) {
		const ids = await client.note.addNotes({
			notes: chunk.map(({ localNote }) => ({
				audio: localNote.audio,
				deckName: localNote.deckName,
				fields: localNote.fields,
				modelName: localNote.modelName,
				options: { allowDuplicate: true },
				picture: localNote.picture,
				tags: localNote.tags,
				video: localNote.video,
			})),
		})

		if (ids === null) {
			throw new Error('addNotes returned null for the entire batch')
		}

		if (ids.length !== chunk.length) {
			throw new Error(`addNotes returned ${ids.length} IDs for ${chunk.length} notes`)
		}

		for (const [i, { localNote }] of chunk.entries()) {
			const id = ids[i]
			if (id === undefined || id === null) {
				failedDescriptions.push(`[${noteIndex + i}] ${describeNote(localNote)}`)
				continue
			}

			localNote.noteId = id
		}

		noteIndex += chunk.length
	}

	if (failedDescriptions.length > 0) {
		throw new Error(
			`addNotes failed for ${failedDescriptions.length} note(s):\n  ${failedDescriptions.join('\n  ')}`,
		)
	}
}

export type UpdateBucketEntry = {
	localNote: YankiNote
	remoteNote: YankiNote
	syncedIndex: number
}

type MultiAction = Parameters<YankiConnect['miscellaneous']['multi']>[0]['actions'][number]

/**
 * Plan the Anki-Connect actions that bring one remote note in line with its
 * local counterpart. `changeDeck` comes before `updateNoteModel`.
 *
 * @returns The actions to run, empty if the notes already match.
 * @throws {Error} If the local note has no ID, the remote note has no cards, or
 *   a deck change targets an empty deck name.
 */
function getUpdateActions(localNote: YankiNote, remoteNote: YankiNote): MultiAction[] {
	if (localNote.noteId === undefined) {
		throw new Error('Local note ID is undefined')
	}

	if (remoteNote.cards === undefined) {
		throw new Error('Remote note cards are undefined')
	}

	const actions: MultiAction[] = []

	if (localNote.deckName !== remoteNote.deckName) {
		if (localNote.deckName === '') {
			throw new Error('Local deck name is empty')
		}

		actions.push({
			action: 'changeDeck',
			params: { cards: remoteNote.cards, deck: localNote.deckName },
			version: 6,
		})
	}

	if (
		!areTagsEqual(localNote.tags ?? [], remoteNote.tags ?? []) ||
		!areFieldsEqual(localNote.fields, remoteNote.fields) ||
		localNote.modelName !== remoteNote.modelName
	) {
		actions.push({
			action: 'updateNoteModel',
			params: {
				note: {
					fields: localNote.fields,
					id: localNote.noteId,
					modelName: localNote.modelName,
					tags: localNote.tags ?? [],
				},
			},
			version: 6,
		})
	}

	return actions
}

/**
 * Apply a batch of note updates by bundling per-note actions (`changeDeck`,
 * `updateNoteModel`) into as few `multi()` requests as the request size budget
 * allows. Media uploads happen later in the consolidated `reconcileMedia`
 * pass.
 *
 * @returns The set of `syncedIndex` values whose notes ended up unchanged (no
 *   diff against their remote) so the caller can downgrade the placeholder
 *   `'updated'` action in `synced[]` to `'unchanged'`.
 * @throws {Error} If any bundled action returned an Anki-Connect error.
 */
export async function executeUpdates(
	client: YankiConnect,
	toUpdate: UpdateBucketEntry[],
	dryRun: boolean,
): Promise<Set<number>> {
	const actions: MultiAction[] = []
	// Parallel array — one entry per pushed action — that maps a multi() response
	// index back to the note it touched so per-action errors can name the note.
	const actionNotes: YankiNote[] = []
	const unchangedSyncedIndices = new Set<number>()

	for (const { localNote, remoteNote, syncedIndex } of toUpdate) {
		const noteActions = getUpdateActions(localNote, remoteNote)
		if (noteActions.length === 0) {
			unchangedSyncedIndices.add(syncedIndex)
			continue
		}

		for (const action of noteActions) {
			actions.push(action)
			actionNotes.push(localNote)
		}
	}

	if (dryRun || actions.length === 0) {
		return unchangedSyncedIndices
	}

	const failures: string[] = []
	await runMultiInChunks(
		client,
		actions,
		(index, { error }) => {
			if (error === null) {
				return
			}

			const action = actions[index]
			const note = actionNotes[index]
			const noteContext = note === undefined ? '' : ` (${describeNote(note)})`
			failures.push(`${action?.action ?? `index ${index}`}${noteContext}: ${error}`)
		},
		Infinity,
	)

	if (failures.length > 0) {
		throw new Error(
			`Update batch had ${failures.length} failed action(s):\n  ${failures.join('\n  ')}`,
		)
	}

	return unchangedSyncedIndices
}

// export async function deleteNote(client: YankiConnect, note: YankiNote, dryRun = false) {
// 	if (note.noteId === undefined) {
// 		throw new Error('Note ID is undefined')
// 	}

// 	if (dryRun) {
// 		return
// 	}

// 	await client.note.deleteNotes({ notes: [note.noteId] })
// }

/**
 * Add a note to Anki.
 *
 * Does "just in time" creation of requisite models and decks.
 *
 * Duplicates will be created if present in the source. It's up to the user to
 * manage their Markdown files as they like.
 *
 * Note: `syncNotes` no longer hits this path — it pre-flights models/decks via
 * `ensureModelsAndDecks` and then batches via `executeCreates`. The "just in
 * time" recovery branches below are kept as defense-in-depth for direct-API
 * consumers (e.g. downstream packages deep-importing from `dist/lib`) and to
 * survive races with the Anki UI deleting a model/deck mid-sync.
 *
 * @param client An instance of YankiConnect
 * @param note The note to add
 * @param dryRun If true, the note will not be created and an ID of 0 will be
 *   returned
 *
 * @returns The ID of the newly created note in Anki
 * @throws {Error}
 */
export async function addNote(
	client: YankiConnect,
	note: YankiNote,
	dryRun: boolean,
	fileAdapter?: FileAdapter,
): Promise<number> {
	if (note.noteId !== undefined) {
		throw new Error('Note already has an ID')
	}

	if (dryRun) {
		return 0
	}

	let newNote: number | undefined
	try {
		// The client returns null on failure, but the project convention is undefined
		newNote =
			(await client.note.addNote({
				note: {
					...note,
					options: {
						allowDuplicate: true,
					},
				},
			})) ?? undefined
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === `model was not found: ${note.modelName}`) {
				// Create the model and try again
				const model = yankiModels.find((model) => model.modelName === note.modelName)
				if (model === undefined) {
					throw new Error(`Model not found: ${note.modelName}`, { cause: error })
				}

				await ensureModelExists(client, model)

				newNote = await addNote(client, note, dryRun, fileAdapter)
			} else if (error.message === `deck was not found: ${note.deckName}`) {
				// Create the deck and try again

				if (note.deckName === '') {
					throw new Error('Deck name is empty', { cause: error })
				}

				await client.deck.createDeck({ deck: note.deckName })
				newNote = await addNote(client, note, dryRun, fileAdapter)
			} else {
				// Do this in parse.ts instead to simplify future local / remote diffs
				// Anki won't create notes if the front field is blank, but we want
				// parity between markdown files and notes at all costs, so we'll put
				// in a placeholder if the front is empty.
				// if (error.message === 'cannot create note because it is empty') {
				// 	return addNote(
				// 		client,
				// 		// eslint-disable-next-line ts/naming-convention
				// 		{ ...note, fields: { ...note.fields, Front: '<p><em>(Empty)</em></p>' } },
				// 		dryRun,
				// 	)
				// }

				throw error
			}
		} else {
			throw new TypeError('Unknown error', { cause: error })
		}
	}

	if (newNote === undefined) {
		throw new Error('Note creation failed')
	}

	await uploadMediaForNote(client, note, dryRun, fileAdapter)

	return newNote
}

/**
 * Updates a note in Anki.
 *
 * Like `addNote`, the per-note recovery branches below are no longer hit by
 * `syncNotes` (replaced by `executeUpdates`); they're retained as
 * defense-in-depth for direct-API consumers and Anki-UI races.
 *
 * @param client An instance of YankiConnect
 * @param localNote A note read from a markdown file
 * @param remoteNote A note loaded from Anki
 *
 * @returns True if the note was updated, false otherwise.
 * @throws {Error} If the local note ID or remote note cards are undefined, or
 *   if model/deck errors occur.
 */
export async function updateNote(
	client: YankiConnect,
	localNote: YankiNote,
	remoteNote: YankiNote,
	dryRun: boolean,
	fileAdapter?: FileAdapter,
): Promise<boolean> {
	// Check if tags are different
	if (localNote.noteId === undefined) {
		throw new Error('Local note ID is undefined')
	}

	if (remoteNote.cards === undefined) {
		throw new Error('Remote note cards are undefined')
	}

	let updated = false

	// Check if decks are different
	// Doing this first fixes https://github.com/kitschpatrol/yanki-obsidian/issues/34
	if (localNote.deckName !== remoteNote.deckName) {
		if (localNote.deckName === '') {
			throw new Error('Local deck name is empty')
		}

		if (!dryRun) {
			// Remember that the local remoteNote object's deck name is not updated...
			await client.deck.changeDeck({ cards: remoteNote.cards, deck: localNote.deckName })
		}

		updated = true
	}

	if (
		!areTagsEqual(localNote.tags ?? [], remoteNote.tags ?? []) ||
		!areFieldsEqual(localNote.fields, remoteNote.fields) ||
		localNote.modelName !== remoteNote.modelName
	) {
		if (!dryRun) {
			// The updateNoteModel command will update:
			// - fields
			// - tags
			// - assigned model

			try {
				await client.note.updateNoteModel({
					note: { ...localNote, id: localNote.noteId, tags: localNote.tags ?? [] },
				})
			} catch (error) {
				if (error instanceof Error) {
					if (error.message === `Model '${localNote.modelName}' not found`) {
						// Create the model and try again
						const model = yankiModels.find((model) => model.modelName === localNote.modelName)
						if (model === undefined) {
							throw new Error(`Model not found: ${localNote.modelName}`, { cause: error })
						}

						await ensureModelExists(client, model)

						await updateNote(client, localNote, remoteNote, dryRun, fileAdapter)
					} else {
						// TODO What about missing decks?
						// updateNoteModel does not throw deck exceptions...
						throw error
					}
				} else {
					throw new TypeError('Unknown error', { cause: error })
				}
			}

			// Always try to update media, in case media assets are missing from Anki
			// Check happens in uploadMediaForNote
			await uploadMediaForNote(client, localNote, dryRun, fileAdapter)
		}

		updated = true
	}

	return updated
}

/**
 * Helper to compare local and remote field contents.
 *
 * @returns True if the fields are equal, false otherwise.
 */
function areFieldsEqual(
	localFields: Record<string, string>,
	remoteFields: Record<string, string>,
): boolean {
	// Limit to front and back keys at the moment
	const keys = ['Front', 'Back', 'Extra']

	for (const key of keys) {
		const localValue = Object.hasOwn(localFields, key) ? localFields[key] : undefined
		const remoteValue = Object.hasOwn(remoteFields, key) ? remoteFields[key] : undefined

		// Both fields have the key (e.g. Extra)
		if (localValue !== undefined && remoteValue !== undefined) {
			if (localValue.normalize('NFC') !== remoteValue.normalize('NFC')) {
				return false
			}
		}
		// Only one fields has the key
		else if (localValue !== undefined || remoteValue !== undefined) {
			return false
		}
	}

	return true
}

export function areNotesEqual(noteA: YankiNote, noteB: YankiNote, includeId = true): boolean {
	// Early exit on simple comparisons before expensive field/tag checks
	if (includeId && noteA.noteId !== noteB.noteId) {
		return false
	}

	if (
		noteA.deckName !== noteB.deckName ||
		noteA.modelName !== noteB.modelName ||
		!areFieldsEqual(noteA.fields, noteB.fields) ||
		!areTagsEqual(noteA.tags ?? [], noteB.tags ?? [])
	) {
		return false
	}

	return true
}

/**
 * Helper function to compare two arrays of tags. Note some nuances around case
 * insensitivity as discussed here:
 * https://github.com/kitschpatrol/yanki-obsidian/issues/44 Anki will
 * alphabetically sort tags, so we sort as well. Duplicate tags are ignored in
 * Anki, so we ignore them here: ['yes', 'yes'] is considered equal to ['yes'].
 * Tags in different orders are considered equal: ['yes', 'no'] is considered
 * equal to ['no', 'yes'].
 *
 * @returns True if the tags are equal, false otherwise.
 */
function areTagsEqual(localTags: string[], remoteTags: string[]): boolean {
	// Create a set of both tags
	const localTagsSet = new Set(localTags.map((tag) => tag.normalize('NFC').toLowerCase()))
	const remoteTagsSet = new Set(remoteTags.map((tag) => tag.normalize('NFC').toLowerCase()))
	const allTagsSet = localTagsSet.union(remoteTagsSet)

	// If the merged tags sets are the same size, then the tags must be equal
	return allTagsSet.size === remoteTagsSet.size
}

/**
 * Get all notes from Anki that match the model prefix.
 *
 * @param client An instance of YankiConnect
 * @param namespace The value of the YankiNamespace field, or search with '*' to
 *   get all notes. Defaults to the global default namespace.
 *
 * @returns An array of YankiNote objects
 * @throws {Error}
 */
export async function getRemoteNotes(
	client: YankiConnect,
	namespace = defaultGlobalOptions.namespace,
): Promise<YankiNote[]> {
	const noteIds = await client.note.findNotes({ query: `"YankiNamespace:${namespace}"` })

	// The findNotes function can return IDs for notes that notesInfo no longer
	// resolves — e.g. transient phantoms left behind when addNote retried after a
	// missing model/deck error. Drop those undefined entries so callers can rely
	// on every returned note being fully populated.
	const notes = await getRemoteNotesById(client, noteIds)
	return notes.filter((note): note is YankiNote => note !== undefined)
}

function getFieldValue(field: undefined | { value: string }): string {
	return field?.value ?? ''
}

/**
 * Get all data from Anki required to populate the YankiNote type.
 *
 * Handles some extra footwork to identify the deck name and validate the model
 * name. There's no way to get everything we need in one shot from AnkiConnect.
 *
 * @param client An instance of YankiConnect
 * @param noteIds An array of note IDs (from `findNotes`) to fetch
 *
 * @returns Array positionally aligned with `noteIds`. Entries are `undefined`
 *   when `notesInfo` does not resolve the corresponding ID — `findNotes` can
 *   return phantom IDs (e.g. left behind by `addNote` retries) that no longer
 *   exist as notes.
 * @throws {Error} If an unknown model name or multiple decks are found for a
 *   note, or if no deck is found.
 */
async function getRemoteNotesById(
	client: YankiConnect,
	noteIds: number[],
): Promise<Array<undefined | YankiNote>> {
	if (noteIds.length === 0) {
		return []
	}

	const ankiNotes = await client.note.notesInfo({ notes: noteIds })

	if (ankiNotes.every((ankiNote) => ankiNote.noteId === undefined)) {
		// All undefined, return early

		// Array.from({ length }) creates an array of `undefined` elements
		return Array.from<undefined>({ length: ankiNotes.length })
	}

	const yankiNotes: Array<undefined | YankiNote> = []

	// Have to fish decks out of the card IDs
	const allCardIds = ankiNotes.flatMap((note) => note.cards ?? [])
	const { cardIdToDeckMap, filteredDeckNames } = await getCardDecks(client, allCardIds)

	// Only notes in filtered decks need a home deck lookup, so skip the extra
	// requests entirely when this sync touches no filtered decks
	const homeDeckCandidates =
		filteredDeckNames.size > 0 ? await getHomeDeckCandidates(client, filteredDeckNames) : []

	for (const ankiNote of ankiNotes) {
		if (ankiNote.noteId === undefined) {
			yankiNotes.push(undefined)
			continue
		}

		if (![...legacyYankiModelNames, ...yankiModelNames].includes(ankiNote.modelName)) {
			throw new Error(`Unknown model name ${ankiNote.modelName} for note ${ankiNote.noteId}`)
		}

		// Cards from the same note can technically be moved to different decks in
		// the Anki GUI, but Yanki does not support this — silently take the first.
		const deckNamesForNote = [...new Set(ankiNote.cards.map((card) => cardIdToDeckMap.get(card)))]
		let deckName = deckNamesForNote.at(0)
		if (deckName === undefined) {
			throw new Error(`No deck found for cards in note ${ankiNote.noteId}`)
		}

		// Look up matching "real" non-filtered decks if the note is in a filtered deck
		if (filteredDeckNames.has(deckName)) {
			const homeDeckName = findHomeDeckNameForNote(homeDeckCandidates, ankiNote.noteId)

			if (homeDeckName === undefined) {
				throw new Error(`No matching non-filtered deck found for note ${ankiNote.noteId}`)
			}

			deckName = homeDeckName
		}

		// Picture, sound, etc. fields are never provided
		yankiNotes.push({
			cards: ankiNote.cards,
			deckName,
			fields: {
				Back: getFieldValue(ankiNote.fields.Back),
				...(ankiNote.fields.Extra !== undefined && { Extra: getFieldValue(ankiNote.fields.Extra) }),
				Front: getFieldValue(ankiNote.fields.Front),
				YankiNamespace: getFieldValue(ankiNote.fields.YankiNamespace),
			},
			modelName: ankiNote.modelName as YankiModelName, // Checked above
			noteId: ankiNote.noteId,
			tags: ankiNote.tags,
		})
	}

	return yankiNotes
}

/**
 * Look up the deck currently holding each of the given cards, and which of
 * those decks are filtered ("dynamic") decks. Both lookups share one request.
 *
 * Anki's `deck:filtered` search works on every supported release, while
 * AnkiConnect 26.10.11.0 and later fail `getDeckConfig` for filtered decks.
 *
 * @throws {Error} If either lookup fails or returns an unexpected shape.
 */
async function getCardDecks(
	client: YankiConnect,
	cardIds: number[],
): Promise<{ cardIdToDeckMap: Map<number, string>; filteredDeckNames: Set<string> }> {
	const [decksResponse, filteredCardsResponse] = await sendMulti(client, [
		{ action: 'getDecks', params: { cards: cardIds }, version: 6 },
		{ action: 'findCards', params: { query: 'deck:filtered' }, version: 6 },
	])

	const cardIdsByDeckName = getMultiResult(decksResponse, 'getDecks')
	if (typeof cardIdsByDeckName !== 'object' || cardIdsByDeckName === null) {
		throw new TypeError(
			`Expected a map of deck names to cards from getDecks, got: ${JSON.stringify(cardIdsByDeckName)}`,
		)
	}

	const cardIdToDeckMap = new Map<number, string>()
	for (const [deckName, deckCardIds] of Object.entries(cardIdsByDeckName)) {
		for (const cardId of toNumberArray(deckCardIds, 'getDecks')) {
			cardIdToDeckMap.set(cardId, deckName)
		}
	}

	const filteredCardIds = toNumberArray(
		getMultiResult(filteredCardsResponse, 'findCards'),
		'findCards',
	)
	const filteredDeckNames = new Set<string>()
	for (const cardId of filteredCardIds) {
		const deckName = cardIdToDeckMap.get(cardId)
		if (deckName !== undefined) {
			filteredDeckNames.add(deckName)
		}
	}

	return { cardIdToDeckMap, filteredDeckNames }
}

type HomeDeckCandidate = {
	deckName: string
	/** Notes with a card in this deck or returning to it */
	noteIds: number[]
}

/**
 * Every deck that could be the home deck of a note whose cards are in a
 * filtered deck, along with the notes each one holds. Filtered decks holding
 * none of the synced cards remain candidates, but never match.
 *
 * Anki's `did:` search matches a card by its current or home deck, and unlike a
 * `deck:` search it ignores child decks, so a filtered child deck can't make
 * its parent look like the home deck.
 *
 * The per-deck searches are bundled via `multi()` so the lookups that follow
 * are served from memory.
 */
async function getHomeDeckCandidates(
	client: YankiConnect,
	filteredDeckNames: Set<string>,
): Promise<HomeDeckCandidate[]> {
	const deckNamesAndIds = await client.deck.deckNamesAndIds()
	const candidateDecks = Object.entries(deckNamesAndIds).filter(
		([deckName]) => !filteredDeckNames.has(deckName),
	)

	const homeDeckCandidates: HomeDeckCandidate[] = []
	const findNotesActions: MultiAction[] = candidateDecks.map(([, deckId]) => ({
		action: 'findNotes',
		params: { query: `did:${deckId}` },
		version: 6,
	}))
	await runMultiOrThrow(
		client,
		findNotesActions,
		(index) => `deck "${candidateDecks[index]?.[0] ?? `index ${index}`}"`,
		(index, result) => {
			const candidateDeck = candidateDecks[index]
			if (candidateDeck === undefined) {
				return
			}

			homeDeckCandidates.push({
				deckName: candidateDeck[0],
				noteIds: toNumberArray(result, 'findNotes'),
			})
		},
	)

	return homeDeckCandidates
}

/**
 * Find the home deck of a note whose cards are in a filtered deck.
 *
 * @returns The name of the note's home deck, or undefined if none is found.
 */
function findHomeDeckNameForNote(
	homeDeckCandidates: HomeDeckCandidate[],
	noteId: number,
): string | undefined {
	return homeDeckCandidates.find((candidate) => candidate.noteIds.includes(noteId))?.deckName
}

export async function deleteOrphanedDecks(
	client: YankiConnect,
	activeNotes: YankiNote[],
	originalNotes: YankiNote[],
	dryRun: boolean,
): Promise<string[]> {
	const activeNoteDeckNames = [...new Set(activeNotes.map((note) => note.deckName))].filter(Boolean)

	const originalNoteDeckNames = [...new Set(originalNotes.map((note) => note.deckName))].filter(
		Boolean,
	)

	// Decks that held notes, and whose tree no active note remains in or arrives in
	const orphanedDeckNames = originalNoteDeckNames.filter((deckName) =>
		activeNoteDeckNames.every((activeDeckName) => !isInDeckTree(activeDeckName, deckName)),
	)

	// Check the parent deck of each orphaned deck
	const orphanedParentDeckNames: string[] = []
	for (const orphanedDeckName of orphanedDeckNames) {
		orphanedParentDeckNames.push(
			...getOrphanedParentDeckNames(orphanedDeckName, activeNoteDeckNames),
		)
	}

	const deckDeletionCandidates = (
		[...new Set([...orphanedDeckNames, ...orphanedParentDeckNames])] as string[]
	).toSorted()
	if (deckDeletionCandidates.length === 0) {
		return []
	}

	const existingDecks = await client.deck.deckNamesAndIds()

	// A dry run leaves every card in place, so subtract the cards a real run
	// would have cleared out by now: those of deleted notes, and those of notes
	// moving to another deck, which is never inside a candidate's tree.
	const activeDeckNames = new Map(activeNotes.map((note) => [note.noteId, note.deckName]))
	const cardsToRemove = new Set(
		dryRun
			? originalNotes
					.filter((note) => {
						const activeDeckName = activeDeckNames.get(note.noteId)
						return activeDeckName === undefined || !isSameDeck(activeDeckName, note.deckName)
					})
					.flatMap((note) => note.cards ?? [])
			: [],
	)
	const existingCandidates = deckDeletionCandidates.filter((deckName) => {
		if (existingDecks[deckName] === undefined) {
			console.warn(`Deck not found for deck name: ${deckName}`)
			return false
		}

		return true
	})

	// Deleting a parent also deletes its descendants. Due counts omit
	// suspended, buried, and future-due cards, while total_in_deck may
	// count only the parent's own cards. Search actual cards instead.
	// Numeric IDs avoid wildcard/quoting rules in deck names. did: also
	// includes cards whose home deck is here while in a filtered deck.
	const cardSearchActions: MultiAction[] = existingCandidates.map((deckName) => ({
		action: 'findCards',
		params: {
			query: Object.entries(existingDecks)
				.filter(([name]) => isInDeckTree(name, deckName))
				.map(([, id]) => `did:${id}`)
				.join(' OR '),
		},
		version: 6,
	}))

	// The searches for every candidate share one request
	const decksToDelete: string[] = []
	await runMultiOrThrow(
		client,
		cardSearchActions,
		(index) => `deck "${existingCandidates[index] ?? `index ${index}`}"`,
		(index, result) => {
			const deckName = existingCandidates[index]
			if (deckName === undefined) {
				return
			}

			if (toNumberArray(result, 'findCards').every((card) => cardsToRemove.has(card))) {
				decksToDelete.push(deckName)
			}
		},
		Infinity,
	)

	if (!dryRun && decksToDelete.length > 0) {
		await client.deck.deleteDecks({
			cardsToo: true,
			decks: withoutDescendantDecks(decksToDelete),
		})
	}

	return decksToDelete
}

/**
 * Anki treats deck names that differ only by case as the same deck.
 */
function isSameDeck(deckName: string, otherDeckName: string): boolean {
	return deckName.toLowerCase() === otherDeckName.toLowerCase()
}

/**
 * Whether a deck is the given root deck or one of its descendants.
 */
function isInDeckTree(deckName: string, rootDeckName: string): boolean {
	return (
		isSameDeck(deckName, rootDeckName) ||
		deckName.toLowerCase().startsWith(`${rootDeckName.toLowerCase()}::`)
	)
}

/**
 * Anki removes a deck's children along with the deck itself, and AnkiConnect
 * 26.x fails a `deleteDecks` request that names a deck an earlier entry already
 * removed that way. Drop every deck that has an ancestor in the list.
 */
function withoutDescendantDecks(deckNames: string[]): string[] {
	return deckNames.filter((deckName) =>
		deckNames.every((otherDeckName) => !deckName.startsWith(`${otherDeckName}::`)),
	)
}

/**
 * Walk up an orphaned deck's ancestry, collecting parent deck names until one
 * is found that still has an active note in its tree.
 */
function getOrphanedParentDeckNames(
	orphanedDeckName: string,
	activeNoteDeckNames: string[],
): string[] {
	const orphanedParentDeckNames: string[] = []
	const parts = orphanedDeckName.split('::')

	while (parts.length > 1) {
		parts.pop()
		const parentDeckName = parts.join('::')
		if (activeNoteDeckNames.some((deckName) => isInDeckTree(deckName, parentDeckName))) {
			break
		}

		orphanedParentDeckNames.push(parentDeckName)
	}

	return orphanedParentDeckNames
}

/**
 * Global! Does not respect namespace. You can write namespace checks into your
 * css if you want.
 */
export async function updateModelStyle(
	client: YankiConnect,
	modelName: string,
	css: string,
	dryRun: boolean,
): Promise<boolean> {
	// Get original css

	// Create model on demand if necessary
	let currentCss: string | undefined
	try {
		const { css: existingCss } = await client.model.modelStyling({ modelName })
		currentCss = existingCss
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === `model was not found: ${modelName}`) {
				// Create the model and try again
				const model = yankiModels.find((model) => model.modelName === modelName)
				if (model === undefined) {
					throw new Error(`Model not found: ${modelName}`, { cause: error })
				}

				if (dryRun) {
					return false
				}

				await ensureModelExists(client, model)

				return updateModelStyle(client, model.modelName, css, dryRun)
			}

			throw error
		}

		throw new TypeError('Unknown error', { cause: error })
	}

	if (currentCss !== undefined && currentCss === css) {
		return false
	}

	if (!dryRun) {
		await client.model.updateModelStyling({
			model: {
				css,
				name: modelName,
			},
		})
	}

	return true
}

export async function getModelStyle(
	client: YankiConnect,
	modelName: string = yankiModelNames[0]!,
): Promise<string> {
	const { css } = await client.model.modelStyling({ modelName })
	return css
}

/**
 * Upload all media files for a note to Anki.
 *
 * @returns Original source name of media files uploaded
 */
async function uploadMediaForNote(
	client: YankiConnect,
	note: YankiNote,
	dryRun: boolean,
	fileAdapter?: FileAdapter,
): Promise<Media[]> {
	// Upload media
	const mediaPaths = extractMediaFromHtml(
		`${note.fields.Front}\n${note.fields.Back}\n${note.fields.Extra}`,
	)

	const uploadedMedia = []

	for (const { filename, originalSrc } of mediaPaths) {
		// Check if it already exists... TODO optimization
		const existing = await client.media.getMediaFilesNames({ pattern: filename })

		if (existing.length === 0) {
			if (!dryRun) {
				try {
					const ankiMediaFilename = await client.media.storeMediaFile(
						isUrl(originalSrc)
							? {
									deleteExisting: true,
									filename,
									url: originalSrc,
								}
							: {
									data: uint8ArrayToBase64(await fileAdapter!.readFileBuffer(originalSrc)),
									deleteExisting: true,
									filename,
								},
					)

					if (filename !== ankiMediaFilename) {
						console.warn(
							`Anki media filename mismatch: Expected: "${filename}" -> Received: "${ankiMediaFilename}"`,
						)
					}
				} catch (error) {
					// E.g. offline...
					console.warn(`Anki could not store media file: "${filename}"\n${String(error)}`)
				}
			}

			uploadedMedia.push({
				filename,
				originalSrc,
			})
		} else {
			// Debugging
			// console.log(`Media file ${filename} already exists in Anki`)
		}
	}

	return uploadedMedia
}

const MULTI_BATCH_CHUNK_SIZE = 25

/**
 * Budget for the serialized size of the items batched into one request.
 * AnkiConnect 26.x rejects request bodies over 16 MiB, so half of that leaves
 * room for the request envelope. An item larger than the budget is sent in a
 * request of its own.
 */
const MAX_BATCH_REQUEST_BYTES = 8 * 1024 * 1024

const textEncoder = new TextEncoder()

/**
 * Split items into consecutive batches for requests that carry many items at
 * once. A batch is closed when it holds `maxCount` items, or when the next item
 * would take its serialized size past `MAX_BATCH_REQUEST_BYTES`.
 */
function chunkForRequest<T>(items: T[], maxCount = Infinity): T[][] {
	const chunks: T[][] = []
	let chunk: T[] = []
	let chunkBytes = 0

	for (const item of items) {
		const itemBytes = textEncoder.encode(JSON.stringify(item)).byteLength
		const isChunkFull = chunk.length >= maxCount || chunkBytes + itemBytes > MAX_BATCH_REQUEST_BYTES
		if (isChunkFull && chunk.length > 0) {
			chunks.push(chunk)
			chunk = []
			chunkBytes = 0
		}

		chunk.push(item)
		chunkBytes += itemBytes
	}

	if (chunk.length > 0) {
		chunks.push(chunk)
	}

	return chunks
}

/**
 * Cap on simultaneous file reads in `reconcileMedia`, which bounds the raw file
 * buffers held in memory while a batch of uploads is being encoded.
 */
const MEDIA_READ_CONCURRENCY = 8

/**
 * Run an async per-item worker over `items` with at most `concurrency`
 * outstanding promises. Workers receive the source index so they can write back
 * into a parallel result array without relying on the iteration order of the
 * worker pool.
 *
 * Worker rejections propagate immediately, matching `Promise.all` semantics.
 */
async function runWithConcurrency<T>(
	items: T[],
	concurrency: number,
	worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
	if (items.length === 0) {
		return
	}

	// Every lane pulls from the same iterator, so each item is handed out once
	const remainingItems = items.entries()
	const lanes: Array<Promise<void>> = []
	const next = async (): Promise<void> => {
		for (const [index, item] of remainingItems) {
			await worker(item, index)
		}
	}

	for (let i = 0; i < Math.min(concurrency, items.length); i++) {
		lanes.push(next())
	}

	await Promise.all(lanes)
}

export type MediaFailure = { filename: string; reason: string }

type ReconcileMediaResult = {
	deleted: string[]
	failedDeletes: MediaFailure[]
	failedUploads: MediaFailure[]
	reuploaded: string[]
}

type CollectedMedia = { filename: string; originalSrc: string; reuploadEligible: boolean }

type MediaUpload = { action: MultiAction; filename: string; reuploadEligible: boolean }

/**
 * Build the `storeMediaFile` action for each media file, reading and
 * base64-encoding local files through the file adapter. Files that can't be
 * read are left out of the result and recorded in `failedUploads`.
 */
async function getMediaUploads(
	entries: CollectedMedia[],
	fileAdapter: FileAdapter | undefined,
	failedUploads: MediaFailure[],
): Promise<MediaUpload[]> {
	const uploads: Array<MediaUpload | undefined> = Array.from<MediaUpload | undefined>({
		length: entries.length,
	})

	await runWithConcurrency(entries, MEDIA_READ_CONCURRENCY, async (entry, index) => {
		const { filename, originalSrc, reuploadEligible } = entry

		if (isUrl(originalSrc)) {
			uploads[index] = {
				action: {
					action: 'storeMediaFile',
					params: { deleteExisting: true, filename, url: originalSrc },
					version: 6,
				},
				filename,
				reuploadEligible,
			}
			return
		}

		if (fileAdapter === undefined) {
			const reason = 'no file adapter provided'
			console.warn(`Could not re-upload local media file "${filename}": ${reason}`)
			failedUploads.push({ filename, reason })
			return
		}

		try {
			const data = uint8ArrayToBase64(await fileAdapter.readFileBuffer(originalSrc))
			uploads[index] = {
				action: {
					action: 'storeMediaFile',
					params: { data, deleteExisting: true, filename },
					version: 6,
				},
				filename,
				reuploadEligible,
			}
		} catch (error) {
			const reason = String(error)
			console.warn(`Could not read local media file "${filename}": ${reason}`)
			failedUploads.push({ filename, reason })
		}
	})

	return uploads.filter((upload) => upload !== undefined)
}

/**
 * Check the response to a `storeMediaFile` action. Anki can store a file under
 * a different name than the one requested, which leaves the note's media
 * reference pointing at a file that doesn't exist.
 *
 * @returns The reason the upload failed, or undefined if it succeeded.
 */
function getStoreMediaFileFailure(
	filename: string,
	response: MultiActionResponse,
): string | undefined {
	if (response.error !== null) {
		return response.error
	}

	if (response.result !== filename) {
		return `stored under a different filename: ${JSON.stringify(response.result)}`
	}

	return undefined
}

/**
 * Reconcile the media files in Anki against the media referenced by the live
 * notes for the given namespace. Missing media is uploaded; orphaned media is
 * deleted. Both passes are bundled via `multi()` in batches of up to 25
 * actions, bounded by the request size budget.
 *
 * `freshWriteNoteIds` (optional) lists the noteIds whose creation/update was
 * the reason for this sync. Media for those notes uploads silently — only
 * uploads triggered by media that _should_ already have been in Anki for
 * matched/unchanged notes show up in the returned `reuploaded` list.
 *
 * Per-file failures (missing file adapter, unreadable local file, Anki-Connect
 * error during upload/delete, a failed upload request) are surfaced via
 * `failedUploads` / `failedDeletes` rather than aborting the whole pass —
 * partial-success media is recoverable on the next sync, but callers can warn
 * the user explicitly.
 *
 * @throws {Error} If the media listing or a delete request fails as a whole.
 */
export async function reconcileMedia(
	client: YankiConnect,
	liveNotes: YankiNote[],
	namespace: string,
	dryRun: boolean,
	fileAdapter?: FileAdapter,
	freshWriteNoteIds?: Set<number>,
): Promise<ReconcileMediaResult> {
	if (dryRun) {
		return { deleted: [], failedDeletes: [], failedUploads: [], reuploaded: [] }
	}

	// Note this always includes a `yanki-` prefix for ease of identification
	// in the Anki media asset manager UI
	const slugifiedNamespace = getSlugifiedNamespace(namespace)

	const collected = new Map<string, CollectedMedia>()
	for (const note of liveNotes) {
		const isFreshWrite = note.noteId !== undefined && (freshWriteNoteIds?.has(note.noteId) ?? false)

		const mediaPaths = extractMediaFromHtml(
			`${note.fields.Front}\n${note.fields.Back}\n${note.fields.Extra}`,
		)

		for (const { filename, originalSrc } of mediaPaths) {
			const existing = collected.get(filename)
			if (existing === undefined) {
				collected.set(filename, { filename, originalSrc, reuploadEligible: !isFreshWrite })
			} else if (isFreshWrite && existing.reuploadEligible) {
				// A fresh-write reference for the same filename downgrades the entry
				// to silent upload — matches old per-note upload behavior.
				existing.reuploadEligible = false
			}
		}
	}

	const presentMedia = new Set(
		await client.media.getMediaFilesNames({ pattern: `${slugifiedNamespace}-*` }),
	)

	const toDelete: string[] = []
	for (const filename of presentMedia) {
		if (!collected.has(filename)) {
			toDelete.push(filename)
		}
	}

	const toUpload: CollectedMedia[] = []
	for (const entry of collected.values()) {
		if (!presentMedia.has(entry.filename)) {
			toUpload.push(entry)
		}
	}

	const failedUploads: MediaFailure[] = []
	const failedDeletes: MediaFailure[] = []
	const reuploaded: string[] = []

	// Read, encode, and upload one batch of files at a time, so the encoded
	// files of a batch are released before the next batch is read
	for (let start = 0; start < toUpload.length; start += MULTI_BATCH_CHUNK_SIZE) {
		const uploads = await getMediaUploads(
			toUpload.slice(start, start + MULTI_BATCH_CHUNK_SIZE),
			fileAdapter,
			failedUploads,
		)

		// A failed request is not fatal: the notes are already in Anki, and the
		// files it carried are uploaded again on the next sync
		const unansweredUploads = new Set(uploads)
		try {
			await runMultiInChunks(
				client,
				uploads.map(({ action }) => action),
				(index, response) => {
					const upload = uploads[index]
					if (upload === undefined) {
						return
					}

					unansweredUploads.delete(upload)
					const reason = getStoreMediaFileFailure(upload.filename, response)
					if (reason !== undefined) {
						console.warn(`Anki could not store media file "${upload.filename}": ${reason}`)
						failedUploads.push({ filename: upload.filename, reason })
					} else if (upload.reuploadEligible) {
						reuploaded.push(upload.filename)
					}
				},
			)
		} catch (error) {
			const reason = String(error)
			for (const { filename } of unansweredUploads) {
				console.warn(`Anki could not store media file "${filename}": ${reason}`)
				failedUploads.push({ filename, reason })
			}
		}
	}

	const mediaDeletionActions: MultiAction[] = toDelete.map((filename) => ({
		action: 'deleteMediaFile',
		params: { filename },
		version: 6,
	}))

	const deleted: string[] = []
	await runMultiInChunks(client, mediaDeletionActions, (index, response) => {
		const filename = toDelete[index]
		if (filename === undefined) {
			return
		}

		if (response.error === null) {
			deleted.push(filename)
		} else {
			console.warn(`Anki could not delete media file "${filename}": ${response.error}`)
			failedDeletes.push({ filename, reason: response.error })
		}
	})

	return { deleted, failedDeletes, failedUploads, reuploaded }
}

// Mirrors the wire-level shape returned by Anki-Connect for each `multi()`
// action. `error` is genuinely `null` (not `undefined`) on the wire, so the
// `null` here is intentional rather than a stand-in for "absent".
// eslint-disable-next-line ts/no-restricted-types
type MultiActionResponse = { error: null | string; result: unknown }

/**
 * Narrow one entry of a `multi()` response to its `{ error, result }` envelope.
 * AnkiConnect wraps a nested action's reply this way whenever the action
 * carries a `version`, as every action sent from this module does, but
 * yanki-connect types the entries as a union that also covers bare results.
 *
 * @throws {TypeError} If the entry is not an `{ error, result }` envelope.
 */
function toMultiActionResponse(value: unknown): MultiActionResponse {
	if (
		typeof value !== 'object' ||
		value === null ||
		!('error' in value) ||
		!('result' in value) ||
		(value.error !== null && typeof value.error !== 'string')
	) {
		throw new TypeError(
			`Expected { error, result } from a multi() action, got: ${JSON.stringify(value)}`,
		)
	}

	return { error: value.error, result: value.result }
}

/**
 * Send one `multi()` request and narrow its reply to one `{ error, result }`
 * envelope per action.
 *
 * AnkiConnect checks the API key on every nested action, while yanki-connect
 * only sends it with the outer request, so the client's key is added to each
 * action here.
 *
 * @throws {Error} If the reply does not hold exactly one response per action.
 */
async function sendMulti(
	client: YankiConnect,
	actions: MultiAction[],
): Promise<MultiActionResponse[]> {
	// The client has no public accessor for its key, and its declaration leaves
	// the private property untyped
	// eslint-disable-next-line ts/dot-notation, prefer-destructuring
	const key: unknown = client['key']
	const keyedActions: MultiAction[] =
		typeof key === 'string'
			? actions.map((action): MultiAction & { key: string } => ({ ...action, key }))
			: actions

	const responses = await client.miscellaneous.multi({ actions: keyedActions })
	if (responses.length !== actions.length) {
		throw new Error(`multi() returned ${responses.length} responses for ${actions.length} actions`)
	}

	return responses.map((response) => toMultiActionResponse(response))
}

/**
 * Generic chunked dispatcher for Anki-Connect's `multi()`. The handler sees
 * each action's response, including per-action errors — caller decides whether
 * to throw, log, or recover. For the common throw-on-error case prefer
 * `runMultiOrThrow`, which centralizes the failure path.
 *
 * A request carries at most `maxActionsPerRequest` actions, and fewer when the
 * request size budget is reached first.
 */
async function runMultiInChunks(
	client: YankiConnect,
	actions: MultiAction[],
	handleResponse: (index: number, response: MultiActionResponse) => void,
	maxActionsPerRequest = MULTI_BATCH_CHUNK_SIZE,
): Promise<void> {
	let chunkStart = 0
	for (const chunk of chunkForRequest(actions, maxActionsPerRequest)) {
		const responses = await sendMulti(client, chunk)
		for (const [i, response] of responses.entries()) {
			handleResponse(chunkStart + i, response)
		}

		chunkStart += chunk.length
	}
}

/**
 * Throw-on-error wrapper around `runMultiInChunks`. The handler is only called
 * for successful actions; per-action errors are converted into a thrown Error
 * tagged with the action name and the caller-provided context.
 *
 * Use this for probes that must succeed (e.g. `findNotes` lookups during note
 * resolution). For best-effort batches that should keep going on partial
 * failure (e.g. media uploads), call `runMultiInChunks` directly and pick a
 * logging policy.
 */
async function runMultiOrThrow(
	client: YankiConnect,
	actions: MultiAction[],
	contextFor: (index: number) => string,
	onSuccess: (index: number, result: unknown) => void,
	maxActionsPerRequest = MULTI_BATCH_CHUNK_SIZE,
): Promise<void> {
	await runMultiInChunks(
		client,
		actions,
		(index, response) => {
			const context = contextFor(index)
			const action = actions[index]?.action ?? `action ${index}`
			if (response.error !== null) {
				throw new Error(`${action} failed for ${context}: ${response.error}`)
			}

			onSuccess(index, response.result)
		},
		maxActionsPerRequest,
	)
}

/**
 * Request permission to access Anki through AnkiConnect, and throw if Anki
 * can't be reached.
 *
 * @throws {Error} If Anki is unreachable, with the
 *   `AnkiConnectUnreachableError` as its `cause`, or if access is denied
 */
export async function requirePermission(client: YankiConnect): Promise<void> {
	let response: Awaited<ReturnType<YankiConnect['miscellaneous']['requestPermission']>>
	try {
		response = await client.miscellaneous.requestPermission()
	} catch (error) {
		if (error instanceof AnkiConnectUnreachableError) {
			throw new Error('Anki is unreachable. Is Anki running?', { cause: error })
		}

		throw error
	}

	if (response.permission === 'denied') {
		throw new Error(
			'Permission denied, please add this source to the "webCorsOriginList" in the AnkiConnect add-on configuration options.',
		)
	}
}

/**
 * Request permission to access Anki through AnkiConnect.
 *
 * @returns 'ankiUnreachable' if Anki is not open, or 'granted' if everything is
 *   copacetic
 * @throws {Error} If access is denied
 */
export async function requestPermission(
	client: YankiConnect,
): Promise<'ankiUnreachable' | 'granted'> {
	try {
		await requirePermission(client)
		return 'granted'
	} catch (error) {
		if (error instanceof Error && error.cause instanceof AnkiConnectUnreachableError) {
			return 'ankiUnreachable'
		}

		throw error
	}
}

export async function syncToAnkiWeb(client: YankiConnect): Promise<void> {
	try {
		await client.miscellaneous.sync()
	} catch {
		// E.g. offline
		// TODO richer errors here
		console.warn('Could not sync to AnkiWeb.')
	}
}

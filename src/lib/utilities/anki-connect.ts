/* eslint-disable complexity */
/* eslint-disable max-depth */
/* eslint-disable ts/no-unnecessary-condition */
/* eslint-disable jsdoc/require-jsdoc */

import type { YankiConnect } from 'yanki-connect'
import { uint8ArrayToBase64 } from 'uint8array-extras'
import type { YankiModelName } from '../model/model'
import type { YankiNote } from '../model/note'
import type { Media } from '../parse/rehype-utilities'
import type { FileAdapter } from '../shared/types'
import { legacyYankiModelNames, yankiModelNames, yankiModels } from '../model/model'
import { extractMediaFromHtml } from '../parse/rehype-utilities'
import { defaultGlobalOptions } from '../shared/types'
import { getSlugifiedNamespace } from './namespace'
import { isUrl } from './url'

export async function deleteNotes(client: YankiConnect, notes: YankiNote[], dryRun = false) {
	if (dryRun) {
		return
	}

	const noteIds = notes.map((note) => note.noteId).filter((noteId) => noteId !== undefined)
	await client.note.deleteNotes({ notes: noteIds })
}

/**
 * Ensure that every required Yanki model and deck exists in Anki before any
 * note add/update calls fire.
 *
 * Lifting this out of the per-note path lets the main sync pass skip the
 * "missing model/deck" recovery branches and unblocks future batched calls.
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

	const [modelsResponse, decksResponse] = await client.miscellaneous.multi({
		actions: [
			{ action: 'modelNames', version: 6 },
			{ action: 'deckNames', version: 6 },
		],
	})

	if (modelsResponse.error !== null) {
		throw new Error(`modelNames failed: ${modelsResponse.error}`)
	}

	if (decksResponse.error !== null) {
		throw new Error(`deckNames failed: ${decksResponse.error}`)
	}

	const existingModels = new Set(toStringArray(modelsResponse.result, 'modelNames'))
	const existingDecks = new Set(toStringArray(decksResponse.result, 'deckNames'))

	const missingModels = [...new Set(modelNames)].filter((name) => !existingModels.has(name))
	const missingDecks = [...new Set(deckNames)].filter(
		(name) => name !== '' && !existingDecks.has(name),
	)

	if (dryRun) {
		return
	}

	for (const modelName of missingModels) {
		const model = yankiModels.find((candidate) => candidate.modelName === modelName)
		if (model === undefined) {
			throw new Error(`Unknown model name: ${modelName}`)
		}

		await client.model.createModel(model)
	}

	for (const deckName of missingDecks) {
		await client.deck.createDeck({ deck: deckName })
	}
}

/**
 * Narrow a `multi()` action result to `string[]`. The yanki-connect typing
 * leaves the result as a loose union of every possible response shape, so we
 * verify at runtime that the action returned what we expect.
 */
function toStringArray(value: unknown, actionName: string): string[] {
	if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
		throw new TypeError(`Expected string[] from ${actionName}, got: ${JSON.stringify(value)}`)
	}

	return value
}

/**
 * Narrow a `multi()` action result to `number[]`. Mirror of `toStringArray` for
 * `findNotes`-style responses.
 */
function toNumberArray(value: unknown, actionName: string): number[] {
	if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'number')) {
		throw new TypeError(`Expected number[] from ${actionName}, got: ${JSON.stringify(value)}`)
	}

	return value
}

/**
 * Narrow a `getDeckConfig` `multi()` result to its `dyn` flag. The full
 * yanki-connect `DeckConfig` shape is large; we only need `dyn`, which is
 * either `1` (filtered) or `false` (regular).
 */
function toDeckDyn(value: unknown, actionName: string, deckName: string): boolean {
	if (
		typeof value !== 'object' ||
		value === null ||
		!('dyn' in value) ||
		(value.dyn !== 1 && value.dyn !== false)
	) {
		throw new TypeError(
			`Expected { dyn: 1 | false } from ${actionName} for deck "${deckName}", got: ${JSON.stringify(value)}`,
		)
	}

	return Boolean(value.dyn)
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

	const front = note.fields.Front.replaceAll(/\s+/g, ' ').trim()
	const preview = front.length > 60 ? `${front.slice(0, 57)}...` : front
	return preview === '' ? '(empty Front field)' : `front "${preview}"`
}

/**
 * Create a batch of notes in a single Anki-Connect roundtrip via `addNotes`.
 * Mutates `localNote.noteId` on each entry as Anki assigns IDs.
 *
 * Pre-flighted models/decks (see `ensureModelsAndDecks`) make this the only
 * write to Anki for note creation — no per-note retry on missing model/deck.
 * Media is handled separately by `reconcileMedia` after the full sync pass.
 *
 * @throws {Error} If `addNotes` returns null entries for any note in the batch.
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

	const ids = await client.note.addNotes({
		notes: toCreate.map(({ localNote }) => ({
			deckName: localNote.deckName,
			fields: localNote.fields,
			modelName: localNote.modelName,
			options: { allowDuplicate: true },
			tags: localNote.tags,
		})),
	})

	if (ids === null) {
		throw new Error('addNotes returned null for the entire batch')
	}

	const failedDescriptions: string[] = []
	for (const [i, id] of ids.entries()) {
		const entry = toCreate[i]
		if (entry === undefined) {
			throw new Error(
				`addNotes returned more IDs (${ids.length}) than notes sent (${toCreate.length})`,
			)
		}

		if (id === null) {
			failedDescriptions.push(`[${i}] ${describeNote(entry.localNote)}`)
			continue
		}

		entry.localNote.noteId = Number(id)
	}

	if (failedDescriptions.length > 0) {
		throw new Error(
			`addNotes failed for ${failedDescriptions.length} note(s):\n  ${failedDescriptions.join('\n  ')}`,
		)
	}
}

type UpdateBucketEntry = {
	localNote: YankiNote
	remoteNote: YankiNote
	syncedIndex: number
}

type MultiAction = Parameters<YankiConnect['miscellaneous']['multi']>[0]['actions'][number]

/**
 * Apply a batch of note updates by bundling per-note actions (`changeDeck`,
 * `updateNoteModel`) into a single `multi()` request. Media uploads happen
 * later in the consolidated `reconcileMedia` pass.
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
		if (localNote.noteId === undefined) {
			throw new Error('Local note ID is undefined')
		}

		if (remoteNote.cards === undefined) {
			throw new Error('Remote note cards are undefined')
		}

		let didChange = false

		if (localNote.deckName !== remoteNote.deckName) {
			if (localNote.deckName === '') {
				throw new Error('Local deck name is empty')
			}

			actions.push({
				action: 'changeDeck',
				params: { cards: remoteNote.cards, deck: localNote.deckName },
				version: 6,
			})
			actionNotes.push(localNote)
			didChange = true
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
			actionNotes.push(localNote)
			didChange = true
		}

		if (!didChange) {
			unchangedSyncedIndices.add(syncedIndex)
		}
	}

	if (dryRun || actions.length === 0) {
		return unchangedSyncedIndices
	}

	const responses = await client.miscellaneous.multi({ actions })
	const failures: string[] = []
	for (const [i, response] of responses.entries()) {
		if (response.error !== null) {
			const action = actions[i]
			const note = actionNotes[i]
			const noteContext = note === undefined ? '' : ` (${describeNote(note)})`
			failures.push(`${action?.action ?? `index ${i}`}${noteContext}: ${response.error}`)
		}
	}

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

	const newNote = await client.note
		.addNote({
			note: {
				...note,
				options: {
					allowDuplicate: true,
				},
			},
		})
		.catch(async (error: unknown) => {
			if (error instanceof Error) {
				if (error.message === `model was not found: ${note.modelName}`) {
					// Create the model and try again
					const model = yankiModels.find((model) => model.modelName === note.modelName)
					if (model === undefined) {
						throw new Error(`Model not found: ${note.modelName}`)
					}

					await client.model.createModel(model)

					return addNote(client, note, dryRun, fileAdapter)
				}

				if (error.message === `deck was not found: ${note.deckName}`) {
					// Create the deck and try again

					if (note.deckName === '') {
						throw new Error('Deck name is empty')
					}

					await client.deck.createDeck({ deck: note.deckName })
					return addNote(client, note, dryRun, fileAdapter)
				}

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
			} else {
				throw new TypeError('Unknown error')
			}
		})

	if (newNote === null) {
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

			await client.note
				.updateNoteModel({
					note: { ...localNote, id: localNote.noteId, tags: localNote.tags ?? [] },
				})
				.catch(async (error: unknown) => {
					if (error instanceof Error) {
						if (error.message === `Model '${localNote.modelName}' not found`) {
							// Create the model and try again
							const model = yankiModels.find((model) => model.modelName === localNote.modelName)
							if (model === undefined) {
								throw new Error(`Model not found: ${localNote.modelName}`)
							}

							await client.model.createModel(model)

							return updateNote(client, localNote, remoteNote, dryRun, fileAdapter)
						}

						// TODO What about missing decks?
						// updateNoteModel does not throw deck exceptions...
						throw error
					} else {
						throw new TypeError('Unknown error')
					}
				})

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
		// Both fields have the key (e.g. Extra)
		if (key in localFields && key in remoteFields) {
			if (localFields[key].normalize('NFC') !== remoteFields[key].normalize('NFC')) {
				return false
			}
		}
		// Only one fields has the key
		else if (key in localFields || key in remoteFields) {
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

	if (noteA.deckName !== noteB.deckName) {
		return false
	}

	if (noteA.modelName !== noteB.modelName) {
		return false
	}

	if (!areFieldsEqual(noteA.fields, noteB.fields)) {
		return false
	}

	if (!areTagsEqual(noteA.tags ?? [], noteB.tags ?? [])) {
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
	const allTagsSet = new Set([...localTagsSet, ...remoteTagsSet])

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

	// We can trust that these are defined, since the list of notes is coming
	// straight from Anki
	return (await getRemoteNotesById(client, noteIds)) as YankiNote[]
}

/**
 * Get all data from Anki required to populate the YankiNote type.
 *
 * Handles some extra footwork to identify the deck name and validate the model
 * name. There's no way to get everything we need in one shot from
 * Anki-Connect.
 *
 * Undefined elements in the returned array are subsequently used to identify
 * notes that need to be created.
 *
 * @param client An instance of YankiConnect
 * @param noteIds An array of local note IDs to (attempt) to fetch
 *
 * @returns Array of YankiNote objects, with undefined for notes that could not
 *   be found.
 * @throws {Error} If an unknown model name or multiple decks are found for a
 *   note, or if no deck is found.
 */
async function getRemoteNotesById(
	client: YankiConnect,
	noteIds: number[],
): Promise<Array<undefined | YankiNote>> {
	const ankiNotes = await client.note.notesInfo({ notes: noteIds })

	if (ankiNotes.every((ankiNote) => ankiNote.noteId === undefined)) {
		// All undefined, return early
		// eslint-disable-next-line unicorn/no-useless-undefined
		return Array.from<undefined>({ length: ankiNotes.length }).fill(undefined)
	}

	// Have to fish decks out of the card IDs
	const allCardIds = ankiNotes.flatMap((note) => note.cards ?? [])
	const deckToCardMap = await client.deck.getDecks({ cards: allCardIds })

	// Map card IDs to deck names for easy lookup
	const cardIdToDeckMap = new Map<number, string>()
	for (const [deck, cards] of Object.entries(deckToCardMap)) {
		for (const card of cards) {
			cardIdToDeckMap.set(card, deck)
		}
	}

	// Phase A — batch getDeckConfig for every deck this sync touches.
	const deckFilteredStatusMap = new Map<string, boolean>()
	const syncDeckNames = Object.keys(deckToCardMap)
	const phaseAActions: MultiAction[] = syncDeckNames.map((deck) => ({
		action: 'getDeckConfig',
		params: { deck },
		version: 6,
	}))
	await runMultiOrThrow(
		client,
		phaseAActions,
		(index) => `deck "${syncDeckNames[index] ?? `index ${index}`}"`,
		(index, result) => {
			const deckName = syncDeckNames[index]
			deckFilteredStatusMap.set(deckName, toDeckDyn(result, 'getDeckConfig', deckName))
		},
	)

	// Phases B + C only run when at least one deck in this sync is filtered.
	const sortedUnfilteredDeckNames: string[] = []
	const unfilteredDeckNoteIdMap = new Map<string, number[]>()
	const anyFiltered = [...deckFilteredStatusMap.values()].some(Boolean)

	if (anyFiltered) {
		// Phase B — fan out to every remaining deck, including Default. Probing
		// one extra deck is cheap (it rides in the same multi() chunks) and
		// avoids silently mis-resolving filtered notes if a user has somehow
		// turned Default into a filtered deck.
		const allDeckNames = await client.deck.deckNames()
		const remainingDecks = allDeckNames.filter((name) => !deckFilteredStatusMap.has(name))
		const phaseBActions: MultiAction[] = remainingDecks.map((deck) => ({
			action: 'getDeckConfig',
			params: { deck },
			version: 6,
		}))
		await runMultiOrThrow(
			client,
			phaseBActions,
			(index) => `deck "${remainingDecks[index] ?? `index ${index}`}"`,
			(index, result) => {
				const deckName = remainingDecks[index]
				deckFilteredStatusMap.set(deckName, toDeckDyn(result, 'getDeckConfig', deckName))
			},
		)

		// Sort decks deep to shallow so a note in `A::B::C` resolves to `A::B::C`
		// rather than the matching parent `A::B`. Default is the least likely
		// home for a Yanki note, so it's appended last.
		for (const [deck, isFiltered] of deckFilteredStatusMap) {
			if (!isFiltered && deck !== 'Default') {
				sortedUnfilteredDeckNames.push(deck)
			}
		}

		sortedUnfilteredDeckNames.sort((a, b) => b.split('::').length - a.split('::').length)
		// Default goes last (least likely to host a Yanki note) — only if it's
		// actually unfiltered. Probed in Phase B, no longer assumed.
		if (deckFilteredStatusMap.get('Default') === false) {
			sortedUnfilteredDeckNames.push('Default')
		}

		// Phase C — eagerly batch findNotes for every unfiltered deck so the
		// main loop below can resolve filtered-deck notes synchronously.
		const phaseCActions: MultiAction[] = sortedUnfilteredDeckNames.map((deck) => ({
			action: 'findNotes',
			params: { query: `"deck:${deck}"` },
			version: 6,
		}))
		await runMultiOrThrow(
			client,
			phaseCActions,
			(index) => `deck "${sortedUnfilteredDeckNames[index] ?? `index ${index}`}"`,
			(index, result) => {
				const deckName = sortedUnfilteredDeckNames[index]
				unfilteredDeckNoteIdMap.set(deckName, toNumberArray(result, 'findNotes'))
			},
		)
	}

	// Phase D — synchronous resolution loop. All deck/note lookups are now
	// served from the maps populated above.
	const yankiNotes: Array<undefined | YankiNote> = []
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

		if (deckFilteredStatusMap.get(deckName)) {
			let found = false
			for (const candidate of sortedUnfilteredDeckNames) {
				if (unfilteredDeckNoteIdMap.get(candidate)?.includes(ankiNote.noteId)) {
					deckName = candidate
					found = true
					break
				}
			}

			if (!found) {
				throw new Error(`No matching non-filtered deck found for note ${ankiNote.noteId}`)
			}
		}

		// Picture, sound, etc. fields are never provided
		yankiNotes.push({
			cards: ankiNote.cards,
			deckName,
			fields: {
				Back: ankiNote.fields.Back.value ?? '',
				...(ankiNote.fields.Extra !== undefined && { Extra: ankiNote.fields.Extra.value ?? '' }),
				Front: ankiNote.fields.Front.value ?? '',
				YankiNamespace: ankiNote.fields.YankiNamespace.value ?? '',
			},
			modelName: ankiNote.modelName as YankiModelName, // Checked above
			noteId: ankiNote.noteId,
			tags: ankiNote.tags,
		})
	}

	return yankiNotes
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

	// Set that's excluded from set of notes deck names and recently deleted notes deck names
	const orphanedDeckNames = originalNoteDeckNames.filter(
		(deckName) => !activeNoteDeckNames.includes(deckName),
	)

	// Check the parent deck of each orphaned deck
	const orphanedParentDeckNames: string[] = []
	for (const orphanedDeckName of orphanedDeckNames) {
		const parts = orphanedDeckName.split('::')
		if (parts.length === 1) {
			continue
		}

		while (parts.length > 1) {
			parts.pop()
			const parentDeckName = parts.join('::')
			if (activeNoteDeckNames.some((deckName) => deckName.startsWith(`${parentDeckName}::`))) {
				break
			}

			orphanedParentDeckNames.push(parentDeckName)
		}
	}

	// This is a dangerous place and (maybe) a potential source of bugs...
	// https://github.com/kitschpatrol/yanki-obsidian/issues/6
	// https://github.com/kitschpatrol/yanki-obsidian/issues/14
	//
	// Two possible issues:
	// 1. The order of the decks returned from `getDeckStats` does not necessarily
	//    match the order of the decks in the `deckDeletionCandidates` array? It's
	//    looking for a matching deck ID anywhere in the hierarchy, which may or
	//    may not be the leaf we want. Solution: Call it one deck at a time.
	// 2. The `total_in_deck` field is apparently not reliable.... sometimes it
	//    can be zero when there are cards in the deck. In those cases, it appears
	//    that `new_count + learn_count + review_count` indicates at least a
	//    partial non-zero quantity. (But it's not the same as `total_in_deck`
	//    when available.) Solution: Take the max of these sources as the deck count.

	const deckDeletionCandidates = (
		[...new Set([...orphanedDeckNames, ...orphanedParentDeckNames])] as string[]
	).sort()

	const decksToDelete: string[] = []

	// Ensure all decks are actually empty
	for (const deckName of deckDeletionCandidates) {
		// One at a time...
		const deckStatsObject = await client.deck.getDeckStats({ decks: [deckName] })
		const deckStatsValues = Object.values(deckStatsObject)

		if (deckStatsValues.length > 1) {
			// This should never happen, but don't touch it
			console.warn(`Multiple decks found for deck name: ${deckName}`)
			continue
		}

		const deckStats = deckStatsValues.at(0)
		if (deckStats === undefined) {
			// Anki claims deck does not exist, but don't touch it
			console.warn(`Deck not found for deck name: ${deckName}`)
			continue
		}

		const cardCount = Math.max(
			deckStats.total_in_deck,
			deckStats.new_count + deckStats.learn_count + deckStats.review_count,
		)

		if (dryRun) {
			// Get number of original notes in the deck, vs the number of cards in the deck now...
			// TODO this is not correct, but only affects dry run...
			// It's a messy card vs. note quantity situation
			const originalCount = originalNotes.filter((note) => note.deckName === deckName).length
			const activeCount = activeNotes.filter((note) => note.deckName === deckName).length

			if (cardCount === originalCount && activeCount === 0 && !decksToDelete.includes(deckName)) {
				decksToDelete.push(deckName)
			}
		} else if (cardCount === 0 && !decksToDelete.includes(deckName)) {
			decksToDelete.push(deckName)
		}
	}

	if (!dryRun) {
		await client.deck.deleteDecks({ cardsToo: true, decks: decksToDelete })
	}

	return decksToDelete
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
		const { css } = await client.model.modelStyling({ modelName })
		currentCss = css
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === `model was not found: ${modelName}`) {
				// Create the model and try again
				const model = yankiModels.find((model) => model.modelName === modelName)
				if (model === undefined) {
					throw new Error(`Model not found: ${modelName}`)
				}

				if (dryRun) {
					return false
				}

				await client.model.createModel(model)

				return updateModelStyle(client, model.modelName, css, dryRun)
			}

			throw error
		} else {
			throw new TypeError('Unknown error')
		}
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
	modelName: string = yankiModelNames[0],
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
 * Cap on simultaneous file reads in `reconcileMedia`. Bigger values shorten
 * cold-sync wall time on small vaults; smaller values keep peak memory bounded
 * on first syncs of large vaults (each read is base64-encoded in memory).
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

	let cursor = 0
	const lanes: Array<Promise<void>> = []
	const next = async (): Promise<void> => {
		while (cursor < items.length) {
			const index = cursor++

			await worker(items[index], index)
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

/**
 * Reconcile the media files in Anki against the media referenced by the live
 * notes for the given namespace. Missing media is uploaded; orphaned media is
 * deleted. Both passes are bundled via `multi()` in chunks of 25 actions.
 *
 * `freshWriteNoteIds` (optional) lists the noteIds whose creation/update was
 * the reason for this sync. Media for those notes uploads silently — only
 * uploads triggered by media that _should_ already have been in Anki for
 * matched/unchanged notes show up in the returned `reuploaded` list, matching
 * the prior reporting semantics.
 *
 * Per-file failures (missing file adapter, unreadable local file, Anki-Connect
 * error during upload/delete) are surfaced via `failedUploads` /
 * `failedDeletes` rather than aborting the whole pass — partial-success media
 * is recoverable on the next sync, but callers can warn the user explicitly.
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

	type CollectedMedia = { filename: string; originalSrc: string; reuploadEligible: boolean }
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

	// Read every local file buffer in parallel up-front so the upload bundles
	// can be sent back-to-back without intermediate I/O. Bounded concurrency so
	// large media collections don't read every file into memory simultaneously
	// — peak memory is O(MEDIA_READ_CONCURRENCY × largest file).
	const buffers: Array<string | undefined> = Array.from<string | undefined>({
		length: toUpload.length,
	})
	await runWithConcurrency(toUpload, MEDIA_READ_CONCURRENCY, async (entry, index) => {
		if (isUrl(entry.originalSrc)) {
			return
		}

		if (fileAdapter === undefined) {
			const reason = 'no file adapter provided'
			console.warn(`Could not re-upload local media file "${entry.filename}": ${reason}`)
			failedUploads.push({ filename: entry.filename, reason })
			return
		}

		try {
			buffers[index] = uint8ArrayToBase64(await fileAdapter.readFileBuffer(entry.originalSrc))
		} catch (error) {
			const reason = String(error)
			console.warn(`Could not read local media file "${entry.filename}": ${reason}`)
			failedUploads.push({ filename: entry.filename, reason })
		}
	})

	const uploadActions: MultiAction[] = []
	const uploadMeta: Array<{ filename: string; reuploadEligible: boolean }> = []
	for (const [i, entry] of toUpload.entries()) {
		if (isUrl(entry.originalSrc)) {
			uploadActions.push({
				action: 'storeMediaFile',
				params: { deleteExisting: true, filename: entry.filename, url: entry.originalSrc },
				version: 6,
			})
			uploadMeta.push({ filename: entry.filename, reuploadEligible: entry.reuploadEligible })
		} else if (buffers[i] !== undefined) {
			uploadActions.push({
				action: 'storeMediaFile',
				params: { data: buffers[i], deleteExisting: true, filename: entry.filename },
				version: 6,
			})
			uploadMeta.push({ filename: entry.filename, reuploadEligible: entry.reuploadEligible })
		}
	}

	const reuploaded: string[] = []
	await runMultiInChunks(client, uploadActions, (index, response) => {
		const meta = uploadMeta[index]
		if (meta === undefined) {
			return
		}

		if (response.error === null) {
			if (meta.reuploadEligible) {
				reuploaded.push(meta.filename)
			}
		} else {
			console.warn(`Anki could not store media file "${meta.filename}": ${response.error}`)
			failedUploads.push({ filename: meta.filename, reason: response.error })
		}
	})

	const deleteActions: MultiAction[] = toDelete.map((filename) => ({
		action: 'deleteMediaFile',
		params: { filename },
		version: 6,
	}))

	const deleted: string[] = []
	await runMultiInChunks(client, deleteActions, (index, response) => {
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
 * Generic chunked dispatcher for Anki-Connect's `multi()`. The handler sees the
 * raw response, including per-action errors — caller decides whether to throw,
 * log, or recover. For the common throw-on-error case prefer `runMultiOrThrow`,
 * which centralizes the failure path.
 */
async function runMultiInChunks(
	client: YankiConnect,
	actions: MultiAction[],
	handleResponse: (index: number, response: MultiActionResponse) => void,
	chunkSize: number = MULTI_BATCH_CHUNK_SIZE,
): Promise<void> {
	for (let i = 0; i < actions.length; i += chunkSize) {
		const chunk = actions.slice(i, i + chunkSize)
		const responses = await client.miscellaneous.multi({ actions: chunk })
		for (const [j, response] of responses.entries()) {
			handleResponse(i + j, response)
		}
	}
}

/**
 * Throw-on-error wrapper around `runMultiInChunks`. The handler is only called
 * for successful actions; per-action errors are converted into a thrown Error
 * tagged with the action name and the caller-provided context.
 *
 * Use this for probes that must succeed (e.g. `getDeckConfig`, `findNotes`
 * lookups during note resolution). For best-effort batches that should keep
 * going on partial failure (e.g. media uploads), call `runMultiInChunks`
 * directly and pick a logging policy.
 */
async function runMultiOrThrow(
	client: YankiConnect,
	actions: MultiAction[],
	contextFor: (index: number) => string,
	onSuccess: (index: number, result: unknown) => void,
): Promise<void> {
	await runMultiInChunks(client, actions, (index, response) => {
		const context = contextFor(index)
		const action = actions[index]?.action ?? `action ${index}`
		if (response.error !== null) {
			throw new Error(`${action} failed for ${context}: ${response.error}`)
		}

		onSuccess(index, response.result)
	})
}

/**
 * Request permission to access Anki through Anki-Connect.
 *
 * @returns 'ankiUnreachable' if Anki is not open, or 'granted' if everything is
 *   copacetic
 * @throws {Error} If access is denied
 */
export async function requestPermission(
	client: YankiConnect,
): Promise<'ankiUnreachable' | 'granted'> {
	try {
		const { permission } = await client.miscellaneous.requestPermission()

		if (permission === 'denied') {
			throw new Error(
				'Permission denied, please add this source to the "webCorsOriginList" in the Anki-Connect add-on configuration options.',
			)
		} else {
			return 'granted'
		}
	} catch (error) {
		if (
			error instanceof Error &&
			// Accommodate error message from requestUrl in Obsidian as well
			(error.message === 'fetch failed' || error.message === 'net::ERR_CONNECTION_REFUSED')
		) {
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

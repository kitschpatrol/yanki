import { describe, expect, it, vi } from 'vitest'
import { YankiConnect } from 'yanki-connect'
import type { YankiNote } from '../src/lib/model/note'
import {
	ensureModelsAndDecks,
	executeCreates,
	executeUpdates,
} from '../src/lib/utilities/anki-connect'

function makeNote(overrides: Partial<YankiNote> = {}): YankiNote {
	return {
		deckName: 'TestDeck',
		fields: {
			Back: 'back content',
			Front: 'front content',
			YankiNamespace: 'test',
		},
		modelName: 'Yanki - Basic',
		noteId: 1,
		tags: [],
		...overrides,
	}
}

type ActionHandler = (params: Record<string, unknown>) => unknown

/**
 * Dispatches incoming `multi()` action arrays to the per-action handlers.
 * Mirrors the helper in `anki-connect.test.ts` — duplicated rather than
 * imported to keep the two unit-test files independently runnable.
 */
function makeMultiMock(handlers: Record<string, ActionHandler | undefined>) {
	type MultiActionInput = { action: string; params?: Record<string, unknown> }
	return vi.fn().mockImplementation(({ actions }: { actions: MultiActionInput[] }) =>
		actions.map(({ action, params = {} }) => {
			const handler = Object.hasOwn(handlers, action) ? handlers[action] : undefined
			if (handler === undefined) {
				// eslint-disable-next-line unicorn/no-null
				return { error: `unhandled action ${action}`, result: null }
			}

			try {
				// eslint-disable-next-line unicorn/no-null
				return { error: null, result: handler(params) }
			} catch (error) {
				return {
					error: error instanceof Error ? error.message : String(error),
					// eslint-disable-next-line unicorn/no-null
					result: null,
				}
			}
		}),
	)
}

const ADD_NOTES_FAILED_PATTERN = /addNotes failed/v
const ADD_NOTES_FRONT_NAMING_PATTERN = /second front[\s\S]*third front/v
const ADD_NOTES_FAILED_INDEX_PATTERN = /\[2\] front "third front"/v
const UPDATE_BATCH_LAST_NOTE_PATTERN = /updateNoteModel \(noteId 3\): model missing/v
const DECK_NAMES_FAILED_PATTERN = /deckNames failed: anki offline/v
const UPDATE_BATCH_NOTE_CONTEXT_PATTERN = /changeDeck.*noteId 2.*no such card/v
const UNKNOWN_MODEL_NAME_PATTERN = /Unknown model name: Bogus Model/v
const MODEL_NAMES_FAILED_PATTERN = /modelNames failed: anki offline/v
const MODEL_NAMES_BAD_SHAPE_PATTERN = /Expected string\[\] from modelNames/v

describe('executeCreates', () => {
	it('returns immediately when toCreate is empty', async () => {
		const addNotes = vi.fn()
		await executeCreates({ note: { addNotes } } as never, [], false)
		expect(addNotes).not.toHaveBeenCalled()
	})

	it('assigns 0 to every noteId in dry run mode', async () => {
		const addNotes = vi.fn()
		const localNotes = [makeNote({ noteId: undefined }), makeNote({ noteId: undefined })]
		await executeCreates(
			{ note: { addNotes } } as never,
			localNotes.map((localNote) => ({ localNote })),
			true,
		)
		expect(addNotes).not.toHaveBeenCalled()
		expect(localNotes[0]?.noteId).toBe(0)
		expect(localNotes[1]?.noteId).toBe(0)
	})

	it('assigns IDs to every entry on a fully successful batch', async () => {
		const addNotes = vi.fn().mockResolvedValue([42, 43, 44])
		const localNotes = [
			makeNote({ noteId: undefined }),
			makeNote({ noteId: undefined }),
			makeNote({ noteId: undefined }),
		]
		await executeCreates(
			{ note: { addNotes } } as never,
			localNotes.map((localNote) => ({ localNote })),
			false,
		)
		expect(localNotes[0]?.noteId).toBe(42)
		expect(localNotes[1]?.noteId).toBe(43)
		expect(localNotes[2]?.noteId).toBe(44)
	})

	it('throws when addNotes returns null for the entire batch', async () => {
		// eslint-disable-next-line unicorn/no-null
		const addNotes = vi.fn().mockResolvedValue(null)
		const localNotes = [makeNote({ noteId: undefined })]
		await expect(
			executeCreates(
				{ note: { addNotes } } as never,
				localNotes.map((localNote) => ({ localNote })),
				false,
			),
		).rejects.toThrow('addNotes returned null for the entire batch')
	})

	/**
	 * IDs are assigned to successful entries before the throw, so callers
	 * observing `localNote.noteId` after the exception will see partial state.
	 */
	it('assigns IDs to successful entries even when other entries fail', async () => {
		// eslint-disable-next-line unicorn/no-null
		const addNotes = vi.fn().mockResolvedValue([42, null, 44])
		const localNotes = [
			makeNote({ noteId: undefined }),
			makeNote({ noteId: undefined }),
			makeNote({ noteId: undefined }),
		]
		await expect(
			executeCreates(
				{ note: { addNotes } } as never,
				localNotes.map((localNote) => ({ localNote })),
				false,
			),
		).rejects.toThrow(ADD_NOTES_FAILED_PATTERN)
		expect(localNotes[0]?.noteId).toBe(42)
		expect(localNotes[1]?.noteId).toBeUndefined()
		expect(localNotes[2]?.noteId).toBe(44)
	})

	it('names failed notes by their Front-field preview in the error message', async () => {
		// eslint-disable-next-line unicorn/no-null
		const addNotes = vi.fn().mockResolvedValue([42, null, null])
		const localNotes = [
			makeNote({
				fields: { Back: 'b', Front: 'first front', YankiNamespace: 'test' },
				noteId: undefined,
			}),
			makeNote({
				fields: { Back: 'b', Front: 'second front', YankiNamespace: 'test' },
				noteId: undefined,
			}),
			makeNote({
				fields: { Back: 'b', Front: 'third front', YankiNamespace: 'test' },
				noteId: undefined,
			}),
		]
		await expect(
			executeCreates(
				{ note: { addNotes } } as never,
				localNotes.map((localNote) => ({ localNote })),
				false,
			),
		).rejects.toThrow(ADD_NOTES_FRONT_NAMING_PATTERN)
	})

	it.each([
		{ ids: [1, 2, 3], message: 'addNotes returned 3 IDs for 2 notes' },
		{ ids: [1], message: 'addNotes returned 1 IDs for 2 notes' },
	])('throws when addNotes returns $ids.length IDs for 2 notes', async ({ ids, message }) => {
		const addNotes = vi.fn().mockResolvedValue(ids)
		const localNotes = [makeNote({ noteId: undefined }), makeNote({ noteId: undefined })]
		await expect(
			executeCreates(
				{ note: { addNotes } } as never,
				localNotes.map((localNote) => ({ localNote })),
				false,
			),
		).rejects.toThrow(message)
		expect(localNotes.map((note) => note.noteId)).toEqual([undefined, undefined])
	})

	it('propagates a rejected addNotes request without assigning IDs', async () => {
		const addNotes = vi
			.fn()
			.mockRejectedValue(new Error("['cannot create note for unknown reason']"))
		const localNotes = [makeNote({ noteId: undefined }), makeNote({ noteId: undefined })]
		await expect(
			executeCreates(
				{ note: { addNotes } } as never,
				localNotes.map((localNote) => ({ localNote })),
				false,
			),
		).rejects.toThrow("['cannot create note for unknown reason']")
		expect(localNotes.map((note) => note.noteId)).toEqual([undefined, undefined])
	})

	it('assigns each note the ID returned at its position', async () => {
		const addNotes = vi
			.fn()
			.mockImplementation(({ notes }: { notes: Array<{ fields: { Front: string } }> }) =>
				notes.map((note) => Number(note.fields.Front)),
			)
		const localNotes = [30, 10, 20].map((id) =>
			makeNote({
				fields: { Back: 'b', Front: String(id), YankiNamespace: 'test' },
				noteId: undefined,
			}),
		)
		await executeCreates(
			{ note: { addNotes } } as never,
			localNotes.map((localNote) => ({ localNote })),
			false,
		)
		expect(localNotes.map((note) => note.noteId)).toEqual([30, 10, 20])
	})

	it('splits notes across addNotes requests to stay within the request size budget', async () => {
		let nextId = 100
		const addNotes = vi
			.fn()
			.mockImplementation(({ notes }: { notes: unknown[] }) => notes.map(() => nextId++))
		// Three megabytes of field content each, against an eight megabyte budget
		const localNotes = ['a', 'b', 'c'].map((letter) =>
			makeNote({
				fields: { Back: 'b', Front: letter.repeat(3 * 1024 * 1024), YankiNamespace: 'test' },
				noteId: undefined,
			}),
		)
		await executeCreates(
			{ note: { addNotes } } as never,
			localNotes.map((localNote) => ({ localNote })),
			false,
		)
		const batchSizes = (addNotes.mock.calls as Array<[{ notes: unknown[] }]>).map(
			([{ notes }]) => notes.length,
		)
		expect(batchSizes).toEqual([2, 1])
		expect(localNotes.map((note) => note.noteId)).toEqual([100, 101, 102])
	})

	it('numbers failed notes by their position across requests', async () => {
		const addNotes = vi
			.fn()
			.mockResolvedValueOnce([1, 2])
			// eslint-disable-next-line unicorn/no-null
			.mockResolvedValueOnce([null])
		const localNotes = ['first front', 'second front', 'third front'].map((front) =>
			makeNote({
				fields: { Back: 'b'.repeat(3 * 1024 * 1024), Front: front, YankiNamespace: 'test' },
				noteId: undefined,
			}),
		)
		await expect(
			executeCreates(
				{ note: { addNotes } } as never,
				localNotes.map((localNote) => ({ localNote })),
				false,
			),
		).rejects.toThrow(ADD_NOTES_FAILED_INDEX_PATTERN)
		expect(localNotes.map((note) => note.noteId)).toEqual([1, 2, undefined])
	})

	it('forwards native media attachments to addNotes', async () => {
		const addNotes = vi.fn().mockResolvedValue([42])
		const picture = [{ fields: ['Back'], filename: 'cat.png', url: 'https://example.com/cat.png' }]
		await executeCreates(
			{ note: { addNotes } } as never,
			[{ localNote: makeNote({ noteId: undefined, picture }) }],
			false,
		)
		const callArgument = addNotes.mock.calls[0]?.[0] as { notes: Array<{ picture: unknown }> }
		expect(callArgument.notes[0]?.picture).toEqual(picture)
	})

	it('passes allowDuplicate: true so Anki accepts content-identical notes', async () => {
		const addNotes = vi.fn().mockResolvedValue([42])
		await executeCreates(
			{ note: { addNotes } } as never,
			[{ localNote: makeNote({ noteId: undefined }) }],
			false,
		)
		const callArg = addNotes.mock.calls[0]?.[0] as {
			notes: Array<{ options: { allowDuplicate: boolean } }>
		}
		expect(callArg.notes[0]?.options.allowDuplicate).toBe(true)
	})
})

describe('executeUpdates', () => {
	it('returns empty set with no multi() call when toUpdate is empty', async () => {
		const multi = vi.fn()
		const result = await executeUpdates({ miscellaneous: { multi } } as never, [], false)
		expect(multi).not.toHaveBeenCalled()
		expect(result.size).toBe(0)
	})

	it('marks every entry unchanged and skips multi() when nothing differs', async () => {
		const multi = vi.fn()
		const note = makeNote({ cards: [10], noteId: 1 })
		const result = await executeUpdates(
			{ miscellaneous: { multi } } as never,
			[
				{ localNote: { ...note }, remoteNote: { ...note }, syncedIndex: 0 },
				{ localNote: { ...note, noteId: 2 }, remoteNote: { ...note, noteId: 2 }, syncedIndex: 1 },
			],
			false,
		)
		expect(multi).not.toHaveBeenCalled()
		expect([...result].toSorted((a, b) => a - b)).toEqual([0, 1])
	})

	it('reports unchanged notes by their synced index, not their position in the batch', async () => {
		const multi = vi
			.fn()
			// eslint-disable-next-line unicorn/no-null
			.mockResolvedValue([{ error: null, result: null }])
		const note = makeNote({ cards: [10], noteId: 1 })
		const result = await executeUpdates(
			{ miscellaneous: { multi } } as never,
			[
				{ localNote: { ...note }, remoteNote: { ...note }, syncedIndex: 4 },
				{
					localNote: { ...note, deckName: 'Moved', noteId: 2 },
					remoteNote: { ...note, noteId: 2 },
					syncedIndex: 7,
				},
				{ localNote: { ...note, noteId: 3 }, remoteNote: { ...note, noteId: 3 }, syncedIndex: 9 },
			],
			false,
		)
		expect([...result].toSorted((a, b) => a - b)).toEqual([4, 9])
	})

	it('sends every action in one request while under the request size budget', async () => {
		const multi = vi.fn().mockImplementation(({ actions }: { actions: unknown[] }) =>
			// eslint-disable-next-line unicorn/no-null
			actions.map(() => ({ error: null, result: null })),
		)
		const toUpdate = Array.from({ length: 30 }, (_, index) => ({
			localNote: makeNote({ deckName: 'New', noteId: index + 1 }),
			remoteNote: makeNote({ cards: [index + 1], deckName: 'Old', noteId: index + 1 }),
			syncedIndex: index,
		}))
		await executeUpdates({ miscellaneous: { multi } } as never, toUpdate, false)
		expect(multi).toHaveBeenCalledTimes(1)
	})

	it('splits large updates across requests and still names the failing note', async () => {
		const multi = vi
			.fn()
			.mockResolvedValueOnce([
				// eslint-disable-next-line unicorn/no-null
				{ error: null, result: null },
				// eslint-disable-next-line unicorn/no-null
				{ error: null, result: null },
			])
			// eslint-disable-next-line unicorn/no-null
			.mockResolvedValueOnce([{ error: 'model missing', result: null }])
		// Three megabytes of field content each, against an eight megabyte budget
		const toUpdate = [1, 2, 3].map((noteId) => ({
			localNote: makeNote({
				fields: { Back: 'n'.repeat(3 * 1024 * 1024), Front: 'new', YankiNamespace: 'test' },
				noteId,
			}),
			remoteNote: makeNote({ cards: [noteId], noteId }),
			syncedIndex: noteId - 1,
		}))
		await expect(
			executeUpdates({ miscellaneous: { multi } } as never, toUpdate, false),
		).rejects.toThrow(UPDATE_BATCH_LAST_NOTE_PATTERN)
		const batchSizes = (multi.mock.calls as Array<[{ actions: unknown[] }]>).map(
			([{ actions }]) => actions.length,
		)
		expect(batchSizes).toEqual([2, 1])
	})

	it('skips multi() in dry run mode but reports unchanged indices', async () => {
		const multi = vi.fn()
		const local = makeNote({ deckName: 'New', noteId: 1 })
		const remote = makeNote({ cards: [10], deckName: 'Old', noteId: 1 })
		const result = await executeUpdates(
			{ miscellaneous: { multi } } as never,
			[{ localNote: local, remoteNote: remote, syncedIndex: 0 }],
			true,
		)
		expect(multi).not.toHaveBeenCalled()
		expect(result.size).toBe(0)
	})

	it('emits changeDeck before updateNoteModel for the same note (issue #34 ordering)', async () => {
		const multi = vi.fn().mockResolvedValue([
			// eslint-disable-next-line unicorn/no-null
			{ error: null, result: undefined },
			// eslint-disable-next-line unicorn/no-null
			{ error: null, result: undefined },
		])
		const local = makeNote({
			deckName: 'NewDeck',
			fields: { Back: 'new', Front: 'new', YankiNamespace: 'test' },
			modelName: 'Yanki - Basic (and reversed card with extra)',
			noteId: 1,
		})
		const remote = makeNote({
			cards: [10],
			deckName: 'OldDeck',
			fields: { Back: 'old', Front: 'old', YankiNamespace: 'test' },
			modelName: 'Yanki - Basic',
			noteId: 1,
		})
		await executeUpdates(
			{ miscellaneous: { multi } } as never,
			[{ localNote: local, remoteNote: remote, syncedIndex: 0 }],
			false,
		)
		const call = multi.mock.calls[0]?.[0] as { actions: Array<{ action: string }> }
		expect(call.actions.map((action) => action.action)).toEqual(['changeDeck', 'updateNoteModel'])
	})

	it('throws with action and noteId context when bundled multi() returns errors', async () => {
		const multi = vi.fn().mockResolvedValue([
			// eslint-disable-next-line unicorn/no-null
			{ error: null, result: undefined },
			// eslint-disable-next-line unicorn/no-null
			{ error: 'no such card', result: null },
		])
		const local1 = makeNote({ deckName: 'New1', noteId: 1 })
		const remote1 = makeNote({ cards: [10], deckName: 'Old1', noteId: 1 })
		const local2 = makeNote({ deckName: 'New2', noteId: 2 })
		const remote2 = makeNote({ cards: [20], deckName: 'Old2', noteId: 2 })
		await expect(
			executeUpdates(
				{ miscellaneous: { multi } } as never,
				[
					{ localNote: local1, remoteNote: remote1, syncedIndex: 0 },
					{ localNote: local2, remoteNote: remote2, syncedIndex: 1 },
				],
				false,
			),
		).rejects.toThrow(UPDATE_BATCH_NOTE_CONTEXT_PATTERN)
	})

	it('throws a TypeError when multi() returns a bare result instead of an envelope', async () => {
		// AnkiConnect only wraps a nested action's reply when the action has a version
		const multi = vi.fn().mockResolvedValue([true])
		const local = makeNote({ deckName: 'New', noteId: 1 })
		const remote = makeNote({ cards: [10], deckName: 'Old', noteId: 1 })
		await expect(
			executeUpdates(
				{ miscellaneous: { multi } } as never,
				[{ localNote: local, remoteNote: remote, syncedIndex: 0 }],
				false,
			),
		).rejects.toThrow('Expected { error, result } from a multi() action, got: true')
	})

	it('throws when local note ID is undefined', async () => {
		const local = makeNote({ noteId: undefined })
		const remote = makeNote({ cards: [10], noteId: 1 })
		await expect(
			executeUpdates(
				{ miscellaneous: { multi: vi.fn() } } as never,
				[{ localNote: local, remoteNote: remote, syncedIndex: 0 }],
				false,
			),
		).rejects.toThrow('Local note ID is undefined')
	})

	it('throws when remote note cards are undefined', async () => {
		const local = makeNote({ noteId: 1 })
		const remote = makeNote({ cards: undefined, noteId: 1 })
		await expect(
			executeUpdates(
				{ miscellaneous: { multi: vi.fn() } } as never,
				[{ localNote: local, remoteNote: remote, syncedIndex: 0 }],
				false,
			),
		).rejects.toThrow('Remote note cards are undefined')
	})

	it('throws when local deck name is empty during a deck change', async () => {
		const local = makeNote({ deckName: '', noteId: 1 })
		const remote = makeNote({ cards: [10], deckName: 'Old', noteId: 1 })
		await expect(
			executeUpdates(
				{ miscellaneous: { multi: vi.fn() } } as never,
				[{ localNote: local, remoteNote: remote, syncedIndex: 0 }],
				false,
			),
		).rejects.toThrow('Local deck name is empty')
	})
})

describe('ensureModelsAndDecks', () => {
	it('throws on empty deck names without contacting Anki', async () => {
		const multi = vi.fn()
		await expect(
			ensureModelsAndDecks({ miscellaneous: { multi } } as never, ['Yanki - Basic'], [''], false),
		).rejects.toThrow('Deck name is empty')
		expect(multi).not.toHaveBeenCalled()
	})

	it('issues the probe even when no models or decks are needed', async () => {
		// Skipping the probe is left to the caller
		const multi = makeMultiMock({
			deckNames: () => [],
			modelNames: () => [],
		})
		await ensureModelsAndDecks({ miscellaneous: { multi } } as never, [], [], false)
		expect(multi).toHaveBeenCalledTimes(1)
	})

	it('creates only models and decks that are missing in Anki', async () => {
		const createModel = vi.fn()
		const createDeck = vi.fn()
		const multi = makeMultiMock({
			createDeck,
			createModel,
			deckNames: () => ['ExistingDeck'],
			modelNames: () => ['Yanki - Basic'],
		})
		await ensureModelsAndDecks(
			{ miscellaneous: { multi } } as never,
			['Yanki - Basic', 'Yanki - Cloze'],
			['ExistingDeck', 'NewDeck'],
			false,
		)
		expect(createModel).toHaveBeenCalledTimes(1)
		const modelArgument = createModel.mock.calls[0]?.[0] as { modelName: string }
		expect(modelArgument.modelName).toBe('Yanki - Cloze')
		expect(createDeck.mock.calls).toEqual([[{ deck: 'NewDeck' }]])
	})

	it('creates every missing model and deck in one request after the probe', async () => {
		const multi = makeMultiMock({
			createDeck: () => 1,
			createModel: () => ({}),
			deckNames: () => [],
			modelNames: () => [],
		})
		const deckNames = Array.from({ length: 30 }, (_, index) => `Deck ${index}`)
		await ensureModelsAndDecks(
			{ miscellaneous: { multi } } as never,
			['Yanki - Basic', 'Yanki - Cloze'],
			deckNames,
			false,
		)
		const requests = (multi.mock.calls as Array<[{ actions: Array<{ action: string }> }]>).map(
			([{ actions }]) => actions.map(({ action }) => action),
		)
		expect(requests).toEqual([
			['modelNames', 'deckNames'],
			['createModel', 'createModel', ...deckNames.map(() => 'createDeck')],
		])
	})

	it('sends no create request when nothing is missing', async () => {
		const multi = makeMultiMock({
			deckNames: () => ['TestDeck'],
			modelNames: () => ['Yanki - Basic'],
		})
		await ensureModelsAndDecks(
			{ miscellaneous: { multi } } as never,
			['Yanki - Basic'],
			['TestDeck'],
			false,
		)
		expect(multi).toHaveBeenCalledTimes(1)
	})

	it('throws "Unknown model name" for an unrecognized Yanki model', async () => {
		const multi = makeMultiMock({
			deckNames: () => [],
			modelNames: () => [],
		})
		await expect(
			ensureModelsAndDecks({ miscellaneous: { multi } } as never, ['Bogus Model'], [], false),
		).rejects.toThrow(UNKNOWN_MODEL_NAME_PATTERN)
	})

	it('tolerates a model that another sync created after the probe', async () => {
		const createModel = vi.fn(() => {
			throw new Error('Model name already exists')
		})
		const createDeck = vi.fn()
		const multi = makeMultiMock({
			createDeck,
			createModel,
			deckNames: () => [],
			modelNames: () => [],
		})
		await expect(
			ensureModelsAndDecks(
				{ miscellaneous: { multi } } as never,
				['Yanki - Basic'],
				['TestDeck'],
				false,
			),
		).resolves.toBeUndefined()
		expect(createModel).toHaveBeenCalledTimes(1)
		expect(createDeck).toHaveBeenCalledTimes(1)
	})

	it.each([
		{
			handlers: {
				createModel() {
					throw new Error('collection is not available')
				},
			},
			message: 'createModel failed for "Yanki - Basic": collection is not available',
		},
		{
			handlers: {
				createDeck() {
					throw new Error('Model name already exists')
				},
				createModel: () => ({}),
			},
			message: 'createDeck failed for "TestDeck": Model name already exists',
		},
	])('throws when a model or deck can not be created: $message', async ({ handlers, message }) => {
		const multi = makeMultiMock({
			...handlers,
			deckNames: () => [],
			modelNames: () => [],
		})
		await expect(
			ensureModelsAndDecks(
				{ miscellaneous: { multi } } as never,
				['Yanki - Basic'],
				['TestDeck'],
				false,
			),
		).rejects.toThrow(message)
	})

	it('does not contact Anki in dry run mode even with missing entries', async () => {
		const multi = makeMultiMock({
			createDeck: () => 1,
			createModel: () => ({}),
			deckNames: () => [],
			modelNames: () => [],
		})
		await ensureModelsAndDecks(
			{ miscellaneous: { multi } } as never,
			['Yanki - Basic'],
			['NewDeck'],
			true,
		)
		expect(multi).not.toHaveBeenCalled()
	})

	it('throws when deckNames probe returns an error', async () => {
		const multi = vi.fn().mockResolvedValue([
			// eslint-disable-next-line unicorn/no-null
			{ error: null, result: [] },
			{ error: 'anki offline', result: undefined },
		])
		await expect(
			ensureModelsAndDecks({ miscellaneous: { multi } } as never, ['Yanki - Basic'], [], false),
		).rejects.toThrow(DECK_NAMES_FAILED_PATTERN)
	})

	it('throws when modelNames probe returns an error', async () => {
		const multi = vi.fn().mockResolvedValue([
			{ error: 'anki offline', result: undefined },
			// eslint-disable-next-line unicorn/no-null
			{ error: null, result: [] },
		])
		await expect(
			ensureModelsAndDecks({ miscellaneous: { multi } } as never, ['Yanki - Basic'], [], false),
		).rejects.toThrow(MODEL_NAMES_FAILED_PATTERN)
	})

	it('rejects malformed probe responses with a TypeError', async () => {
		const multi = vi.fn().mockResolvedValue([
			// eslint-disable-next-line unicorn/no-null
			{ error: null, result: { not: 'an array' } },
			// eslint-disable-next-line unicorn/no-null
			{ error: null, result: [] },
		])
		await expect(
			ensureModelsAndDecks({ miscellaneous: { multi } } as never, ['Yanki - Basic'], [], false),
		).rejects.toThrow(MODEL_NAMES_BAD_SHAPE_PATTERN)
	})

	it('rejects a multi() reply that is missing a probe response', async () => {
		// eslint-disable-next-line unicorn/no-null
		const multi = vi.fn().mockResolvedValue([{ error: null, result: [] }])
		await expect(
			ensureModelsAndDecks({ miscellaneous: { multi } } as never, ['Yanki - Basic'], [], false),
		).rejects.toThrow('multi() returned 1 responses for 2 actions')
	})
})

describe('multi() requests', () => {
	/**
	 * A real client over a fake transport that answers the model and deck name
	 * probes, recording every request body it receives.
	 */
	function makeRecordingClient(key?: string) {
		type RequestBody = {
			action: string
			key?: string
			params?: { actions?: Array<{ action: string; key?: string }> }
		}

		const requests: RequestBody[] = []
		const client = new YankiConnect({
			autoLaunch: false,
			async fetchAdapter(_url, init) {
				await Promise.resolve()
				const request = JSON.parse(init?.body ?? '{}') as RequestBody
				requests.push(request)
				return {
					headers: {},
					json: vi.fn().mockResolvedValue({
						// eslint-disable-next-line unicorn/no-null
						error: null,
						// eslint-disable-next-line unicorn/no-null
						result: (request.params?.actions ?? []).map(() => ({ error: null, result: [] })),
					}),
					status: 200,
				}
			},
			...(key !== undefined && { key }),
		})

		return { client, requests }
	}

	it('sends the API key with every nested action, as AnkiConnect checks each one', async () => {
		const { client, requests } = makeRecordingClient('secret')
		await ensureModelsAndDecks(client, [], [], false)

		expect(requests).toHaveLength(1)
		expect(requests[0]?.key).toBe('secret')
		expect(requests[0]?.params?.actions).toEqual([
			{ action: 'modelNames', key: 'secret', version: 6 },
			{ action: 'deckNames', key: 'secret', version: 6 },
		])
	})

	it('leaves nested actions without a key when the client has none', async () => {
		const { client, requests } = makeRecordingClient()
		await ensureModelsAndDecks(client, [], [], false)

		expect(requests[0]?.params?.actions).toEqual([
			{ action: 'modelNames', version: 6 },
			{ action: 'deckNames', version: 6 },
		])
	})
})

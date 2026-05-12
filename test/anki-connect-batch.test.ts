import { describe, expect, it, vi } from 'vitest'
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

type MultiActionInput = { action: string; params?: Record<string, unknown> }
type ActionHandler = (params: Record<string, unknown>) => unknown
// eslint-disable-next-line ts/no-restricted-types
type MultiResponse = { error: null | string; result: unknown }

/**
 * Dispatches incoming `multi()` action arrays to the per-action handlers.
 * Mirrors the helper in `anki-connect.test.ts` — duplicated rather than
 * imported to keep the two unit-test files independently runnable.
 */
function makeMultiMock(handlers: Record<string, ActionHandler>) {
	return vi.fn().mockImplementation(({ actions }: { actions: MultiActionInput[] }) => {
		const responses: MultiResponse[] = actions.map(({ action, params = {} }) => {
			if (!Object.hasOwn(handlers, action)) {
				// eslint-disable-next-line unicorn/no-null
				return { error: `unhandled action ${action}`, result: null }
			}

			const handler = handlers[action]
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
		})
		return responses
	})
}

const ADD_NOTES_FAILED_PATTERN = /addNotes failed/
const ADD_NOTES_FRONT_NAMING_PATTERN = /second front[\s\S]*third front/
const ADD_NOTES_TOO_MANY_IDS_PATTERN = /returned more IDs/
const UPDATE_BATCH_NOTE_CONTEXT_PATTERN = /changeDeck.*noteId 2.*no such card/
const UNKNOWN_MODEL_NAME_PATTERN = /Unknown model name: Bogus Model/
const MODEL_NAMES_FAILED_PATTERN = /modelNames failed: anki offline/
const MODEL_NAMES_BAD_SHAPE_PATTERN = /Expected string\[\] from modelNames/

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
	 * Documents the partial-failure behavior flagged in the audit (risk #1): IDs
	 * are assigned to successful entries before the throw, so callers observing
	 * `localNote.noteId` after the exception will see partial state.
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

	it('throws when addNotes returns more IDs than notes sent', async () => {
		const addNotes = vi.fn().mockResolvedValue([1, 2, 3])
		const localNotes = [makeNote({ noteId: undefined }), makeNote({ noteId: undefined })]
		await expect(
			executeCreates(
				{ note: { addNotes } } as never,
				localNotes.map((localNote) => ({ localNote })),
				false,
			),
		).rejects.toThrow(ADD_NOTES_TOO_MANY_IDS_PATTERN)
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
		expect([...result].sort((a, b) => a - b)).toEqual([0, 1])
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

	it('still issues the probe when models and decks are empty (current behavior)', async () => {
		// Documents existing behavior. If Hardening D moves the skip into syncNotes,
		// this test should keep passing — the probe runs unconditionally inside
		// ensureModelsAndDecks itself.
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
			deckNames: () => ['ExistingDeck'],
			modelNames: () => ['Yanki - Basic'],
		})
		await ensureModelsAndDecks(
			{
				deck: { createDeck },
				miscellaneous: { multi },
				model: { createModel },
			} as never,
			['Yanki - Basic', 'Yanki - Cloze'],
			['ExistingDeck', 'NewDeck'],
			false,
		)
		expect(createModel).toHaveBeenCalledTimes(1)
		const createModelArg = createModel.mock.calls[0]?.[0] as { modelName: string }
		expect(createModelArg.modelName).toBe('Yanki - Cloze')
		expect(createDeck).toHaveBeenCalledWith({ deck: 'NewDeck' })
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

	it('does not create anything in dry run mode even with missing entries', async () => {
		const createModel = vi.fn()
		const createDeck = vi.fn()
		const multi = makeMultiMock({
			deckNames: () => [],
			modelNames: () => [],
		})
		await ensureModelsAndDecks(
			{
				deck: { createDeck },
				miscellaneous: { multi },
				model: { createModel },
			} as never,
			['Yanki - Basic'],
			['NewDeck'],
			true,
		)
		expect(createModel).not.toHaveBeenCalled()
		expect(createDeck).not.toHaveBeenCalled()
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
})

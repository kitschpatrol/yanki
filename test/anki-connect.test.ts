import { describe, expect, it, vi } from 'vitest'
import type { YankiNote } from '../src/lib/model/note'
import {
	addNote,
	areNotesEqual,
	deleteNotes,
	deleteOrphanedDecks,
	getRemoteNotes,
	reconcileMedia,
	requestPermission,
	syncToAnkiWeb,
	updateModelStyle,
	updateNote,
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
type MultiCall = [{ actions: MultiActionInput[] }]

/**
 * Dispatches incoming `multi()` action arrays to the per-action handlers.
 * Returns one `{error, result}` entry per action — matching Anki-Connect's wire
 * shape — so the production code's chunked dispatcher can be exercised.
 *
 * Handlers may throw to simulate a per-action error response; the thrown
 * message becomes the response's `error` field.
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

function makeAnkiNote(noteId: number, cards: number[]): Record<string, unknown> {
	return {
		cards,
		fields: {
			Back: { value: `back-${noteId}` },
			Front: { value: `front-${noteId}` },
			YankiNamespace: { value: 'test' },
		},
		modelName: 'Yanki - Basic',
		noteId,
		tags: [],
	}
}

describe('areNotesEqual', () => {
	it('returns true for identical notes', () => {
		const note = makeNote()
		expect(areNotesEqual(note, { ...note })).toBe(true)
	})

	it('returns false for different note IDs when includeId is true', () => {
		const noteA = makeNote({ noteId: 1 })
		const noteB = makeNote({ noteId: 2 })
		expect(areNotesEqual(noteA, noteB, true)).toBe(false)
	})

	it('returns true for different note IDs when includeId is false', () => {
		const noteA = makeNote({ noteId: 1 })
		const noteB = makeNote({ noteId: 2 })
		expect(areNotesEqual(noteA, noteB, false)).toBe(true)
	})

	it('returns false for different deck names', () => {
		const noteA = makeNote({ deckName: 'Deck A' })
		const noteB = makeNote({ deckName: 'Deck B' })
		expect(areNotesEqual(noteA, noteB)).toBe(false)
	})

	it('returns false for different model names', () => {
		const noteA = makeNote({ modelName: 'Yanki - Basic' })
		const noteB = makeNote({ modelName: 'Yanki - Basic (and reversed card with extra)' })
		expect(areNotesEqual(noteA, noteB)).toBe(false)
	})

	it('returns false for different field content', () => {
		const noteA = makeNote({ fields: { Back: 'a', Front: 'same', YankiNamespace: 'test' } })
		const noteB = makeNote({ fields: { Back: 'b', Front: 'same', YankiNamespace: 'test' } })
		expect(areNotesEqual(noteA, noteB)).toBe(false)
	})

	it('returns false when one note has Extra field and the other does not', () => {
		const noteA = makeNote({
			fields: { Back: 'back', Extra: 'extra', Front: 'front', YankiNamespace: 'test' },
		})
		const noteB = makeNote({
			fields: { Back: 'back', Front: 'front', YankiNamespace: 'test' },
		})
		expect(areNotesEqual(noteA, noteB)).toBe(false)
	})

	it('returns true for tags in different order', () => {
		const noteA = makeNote({ tags: ['alpha', 'beta'] })
		const noteB = makeNote({ tags: ['beta', 'alpha'] })
		expect(areNotesEqual(noteA, noteB)).toBe(true)
	})

	it('returns true for tags with different case', () => {
		const noteA = makeNote({ tags: ['Alpha', 'Beta'] })
		const noteB = makeNote({ tags: ['alpha', 'beta'] })
		expect(areNotesEqual(noteA, noteB)).toBe(true)
	})

	it('returns true for duplicate tags vs unique tags', () => {
		const noteA = makeNote({ tags: ['alpha', 'alpha'] })
		const noteB = makeNote({ tags: ['alpha'] })
		expect(areNotesEqual(noteA, noteB)).toBe(true)
	})

	it('returns false for different tags', () => {
		const noteA = makeNote({ tags: ['alpha'] })
		const noteB = makeNote({ tags: ['beta'] })
		expect(areNotesEqual(noteA, noteB)).toBe(false)
	})

	it('handles unicode normalization in fields', () => {
		// É as single codepoint vs. e + combining accent
		const noteA = makeNote({ fields: { Back: '\u00E9', Front: 'f', YankiNamespace: 'test' } })
		const noteB = makeNote({
			fields: { Back: '\u0065\u0301', Front: 'f', YankiNamespace: 'test' },
		})
		expect(areNotesEqual(noteA, noteB)).toBe(true)
	})

	it('handles undefined tags as empty arrays', () => {
		const noteA = makeNote({ tags: undefined })
		const noteB = makeNote({ tags: [] })
		expect(areNotesEqual(noteA, noteB)).toBe(true)
	})
})

describe('deleteNotes', () => {
	it('skips deletion in dry run mode', async () => {
		const client = {
			note: {
				deleteNotes: vi.fn(),
			},
		}

		await deleteNotes(client as never, [makeNote()], true)
		expect(client.note.deleteNotes).not.toHaveBeenCalled()
	})

	it('calls deleteNotes with note IDs', async () => {
		const client = {
			note: {
				deleteNotes: vi.fn(),
			},
		}

		await deleteNotes(client as never, [makeNote({ noteId: 42 }), makeNote({ noteId: 99 })])
		expect(client.note.deleteNotes).toHaveBeenCalledWith({ notes: [42, 99] })
	})

	it('filters out undefined note IDs', async () => {
		const client = {
			note: {
				deleteNotes: vi.fn(),
			},
		}

		await deleteNotes(client as never, [makeNote({ noteId: 42 }), makeNote({ noteId: undefined })])
		expect(client.note.deleteNotes).toHaveBeenCalledWith({ notes: [42] })
	})
})

describe('addNote', () => {
	it('returns 0 in dry run mode', async () => {
		const result = await addNote({} as never, makeNote({ noteId: undefined }), true)
		expect(result).toBe(0)
	})

	it('throws if note already has an ID', async () => {
		await expect(addNote({} as never, makeNote({ noteId: 123 }), false)).rejects.toThrow(
			'Note already has an ID',
		)
	})

	it('creates model on demand when model not found', async () => {
		const client = {
			media: { getMediaFilesNames: vi.fn().mockResolvedValue([]) },
			model: { createModel: vi.fn() },
			note: {
				addNote: vi
					.fn()
					.mockRejectedValueOnce(new Error('model was not found: Yanki - Basic'))
					.mockResolvedValueOnce(42),
			},
		}

		const result = await addNote(client as never, makeNote({ noteId: undefined }), false)
		expect(result).toBe(42)
		expect(client.model.createModel).toHaveBeenCalled()
	})

	it('throws for unknown model name during addNote model creation', async () => {
		const client = {
			note: {
				addNote: vi.fn().mockRejectedValue(new Error('model was not found: Fake Model')),
			},
		}

		await expect(
			addNote(
				client as never,
				makeNote({ modelName: 'Fake Model' as never, noteId: undefined }),
				false,
			),
		).rejects.toThrow('Model not found: Fake Model')
	})

	it('creates deck on demand when deck not found', async () => {
		const client = {
			deck: { createDeck: vi.fn() },
			media: { getMediaFilesNames: vi.fn().mockResolvedValue([]) },
			note: {
				addNote: vi
					.fn()
					.mockRejectedValueOnce(new Error('deck was not found: TestDeck'))
					.mockResolvedValueOnce(42),
			},
		}

		const result = await addNote(client as never, makeNote({ noteId: undefined }), false)
		expect(result).toBe(42)
		expect(client.deck.createDeck).toHaveBeenCalledWith({ deck: 'TestDeck' })
	})

	it('throws for empty deck name when deck not found', async () => {
		const client = {
			note: {
				addNote: vi.fn().mockRejectedValue(new Error('deck was not found: ')),
			},
		}

		await expect(
			addNote(client as never, makeNote({ deckName: '', noteId: undefined }), false),
		).rejects.toThrow('Deck name is empty')
	})

	it('rethrows unrecognized Error exceptions', async () => {
		const client = {
			note: {
				addNote: vi.fn().mockRejectedValue(new Error('something unexpected')),
			},
		}

		await expect(addNote(client as never, makeNote({ noteId: undefined }), false)).rejects.toThrow(
			'something unexpected',
		)
	})

	it('throws TypeError for non-Error exceptions', async () => {
		const client = {
			note: {
				addNote: vi.fn().mockRejectedValue('string error'),
			},
		}

		await expect(addNote(client as never, makeNote({ noteId: undefined }), false)).rejects.toThrow(
			'Unknown error',
		)
	})

	it('throws when note creation returns null', async () => {
		const client = {
			note: {
				// eslint-disable-next-line unicorn/no-null
				addNote: vi.fn().mockResolvedValue(null),
			},
		}

		await expect(addNote(client as never, makeNote({ noteId: undefined }), false)).rejects.toThrow(
			'Note creation failed',
		)
	})
})

describe('updateNote', () => {
	it('throws if local note ID is undefined', async () => {
		await expect(
			updateNote({} as never, makeNote({ noteId: undefined }), makeNote({ cards: [1] }), false),
		).rejects.toThrow('Local note ID is undefined')
	})

	it('throws if remote note cards are undefined', async () => {
		await expect(
			updateNote({} as never, makeNote({ noteId: 1 }), makeNote({ cards: undefined }), false),
		).rejects.toThrow('Remote note cards are undefined')
	})

	it('returns false when notes are identical', async () => {
		const note = makeNote({ cards: [1], noteId: 1 })
		const result = await updateNote({} as never, note, { ...note }, false)
		expect(result).toBe(false)
	})

	it('changes deck when deck names differ', async () => {
		const changeDeck = vi.fn()

		const local = makeNote({ deckName: 'NewDeck', noteId: 1 })
		const remote = makeNote({ cards: [10], deckName: 'OldDeck', noteId: 1 })

		const result = await updateNote({ deck: { changeDeck } } as never, local, remote, false)
		expect(result).toBe(true)
		expect(changeDeck).toHaveBeenCalledWith({ cards: [10], deck: 'NewDeck' })
	})

	it('throws when local deck name is empty on deck change', async () => {
		const local = makeNote({ deckName: '', noteId: 1 })
		const remote = makeNote({ cards: [10], deckName: 'OldDeck', noteId: 1 })

		await expect(updateNote({} as never, local, remote, false)).rejects.toThrow(
			'Local deck name is empty',
		)
	})

	it('skips deck change in dry run mode', async () => {
		const changeDeck = vi.fn()

		const local = makeNote({ deckName: 'NewDeck', noteId: 1 })
		const remote = makeNote({ cards: [10], deckName: 'OldDeck', noteId: 1 })

		const result = await updateNote({ deck: { changeDeck } } as never, local, remote, true)
		expect(result).toBe(true)
		expect(changeDeck).not.toHaveBeenCalled()
	})

	it('updates fields and tags via updateNoteModel', async () => {
		const client = {
			media: { getMediaFilesNames: vi.fn().mockResolvedValue(['existing.png']) },
			// eslint-disable-next-line unicorn/no-useless-undefined
			note: { updateNoteModel: vi.fn().mockResolvedValue(undefined) },
		}

		const local = makeNote({
			fields: { Back: 'new back', Front: 'new front', YankiNamespace: 'test' },
			noteId: 1,
		})
		const remote = makeNote({
			cards: [10],
			fields: { Back: 'old back', Front: 'old front', YankiNamespace: 'test' },
			noteId: 1,
		})

		const result = await updateNote(client as never, local, remote, false)
		expect(result).toBe(true)
		expect(client.note.updateNoteModel).toHaveBeenCalled()
	})

	it('creates model on demand during updateNoteModel', async () => {
		const client = {
			media: { getMediaFilesNames: vi.fn().mockResolvedValue([]) },
			model: { createModel: vi.fn() },
			note: {
				updateNoteModel: vi
					.fn()
					.mockRejectedValueOnce(new Error("Model 'Yanki - Basic' not found"))
					// eslint-disable-next-line unicorn/no-useless-undefined
					.mockResolvedValueOnce(undefined),
			},
		}

		const local = makeNote({
			fields: { Back: 'new', Front: 'front', YankiNamespace: 'test' },
			noteId: 1,
		})
		const remote = makeNote({
			cards: [10],
			fields: { Back: 'old', Front: 'front', YankiNamespace: 'test' },
			noteId: 1,
		})

		const result = await updateNote(client as never, local, remote, false)
		expect(result).toBe(true)
		expect(client.model.createModel).toHaveBeenCalled()
	})

	it('rethrows unrecognized errors during updateNoteModel', async () => {
		const client = {
			note: {
				updateNoteModel: vi.fn().mockRejectedValue(new Error('unexpected error')),
			},
		}

		const local = makeNote({
			fields: { Back: 'new', Front: 'front', YankiNamespace: 'test' },
			noteId: 1,
		})
		const remote = makeNote({
			cards: [10],
			fields: { Back: 'old', Front: 'front', YankiNamespace: 'test' },
			noteId: 1,
		})

		await expect(updateNote(client as never, local, remote, false)).rejects.toThrow(
			'unexpected error',
		)
	})

	it('throws TypeError for non-Error exceptions during updateNoteModel', async () => {
		const client = {
			note: {
				updateNoteModel: vi.fn().mockRejectedValue('string error'),
			},
		}

		const local = makeNote({
			fields: { Back: 'new', Front: 'front', YankiNamespace: 'test' },
			noteId: 1,
		})
		const remote = makeNote({
			cards: [10],
			fields: { Back: 'old', Front: 'front', YankiNamespace: 'test' },
			noteId: 1,
		})

		await expect(updateNote(client as never, local, remote, false)).rejects.toThrow('Unknown error')
	})
})

describe('updateModelStyle', () => {
	it('returns false when CSS is unchanged', async () => {
		const client = {
			model: {
				modelStyling: vi.fn().mockResolvedValue({ css: '.card { color: red; }' }),
				updateModelStyling: vi.fn(),
			},
		}

		const result = await updateModelStyle(
			client as never,
			'Yanki - Basic',
			'.card { color: red; }',
			false,
		)
		expect(result).toBe(false)
		expect(client.model.updateModelStyling).not.toHaveBeenCalled()
	})

	it('updates CSS when different', async () => {
		const client = {
			model: {
				modelStyling: vi.fn().mockResolvedValue({ css: '.card { color: red; }' }),
				updateModelStyling: vi.fn(),
			},
		}

		const result = await updateModelStyle(
			client as never,
			'Yanki - Basic',
			'.card { color: blue; }',
			false,
		)
		expect(result).toBe(true)
		expect(client.model.updateModelStyling).toHaveBeenCalled()
	})

	it('skips update in dry run mode', async () => {
		const client = {
			model: {
				modelStyling: vi.fn().mockResolvedValue({ css: '.card { color: red; }' }),
				updateModelStyling: vi.fn(),
			},
		}

		const result = await updateModelStyle(
			client as never,
			'Yanki - Basic',
			'.card { color: blue; }',
			true,
		)
		expect(result).toBe(true)
		expect(client.model.updateModelStyling).not.toHaveBeenCalled()
	})

	it('creates model when not found and retries', async () => {
		let callCount = 0
		const client = {
			model: {
				createModel: vi.fn(),
				modelStyling: vi.fn().mockImplementation(() => {
					callCount++
					if (callCount === 1) {
						throw new Error('model was not found: Yanki - Basic')
					}

					return { css: '.old' }
				}),
				updateModelStyling: vi.fn(),
			},
		}

		const result = await updateModelStyle(client as never, 'Yanki - Basic', '.new', false)
		expect(result).toBe(true)
		expect(client.model.createModel).toHaveBeenCalled()
	})

	it('returns false for model not found in dry run mode', async () => {
		const client = {
			model: {
				modelStyling: vi.fn().mockRejectedValue(new Error('model was not found: Yanki - Basic')),
			},
		}

		const result = await updateModelStyle(client as never, 'Yanki - Basic', '.new', true)
		expect(result).toBe(false)
	})

	it('throws for unknown model name during creation', async () => {
		const client = {
			model: {
				modelStyling: vi.fn().mockRejectedValue(new Error('model was not found: Unknown Model')),
			},
		}

		await expect(updateModelStyle(client as never, 'Unknown Model', '.new', false)).rejects.toThrow(
			'Model not found: Unknown Model',
		)
	})

	it('rethrows non-model errors', async () => {
		const client = {
			model: {
				modelStyling: vi.fn().mockRejectedValue(new Error('network error')),
			},
		}

		await expect(updateModelStyle(client as never, 'Yanki - Basic', '.new', false)).rejects.toThrow(
			'network error',
		)
	})

	it('throws TypeError for non-Error exceptions', async () => {
		const client = {
			model: {
				modelStyling: vi.fn().mockRejectedValue('string error'),
			},
		}

		await expect(updateModelStyle(client as never, 'Yanki - Basic', '.new', false)).rejects.toThrow(
			'Unknown error',
		)
	})
})

describe('requestPermission', () => {
	it('returns granted when permission is granted', async () => {
		const client = {
			miscellaneous: {
				requestPermission: vi.fn().mockResolvedValue({ permission: 'granted' }),
			},
		}

		const result = await requestPermission(client as never)
		expect(result).toBe('granted')
	})

	it('throws when permission is denied', async () => {
		const client = {
			miscellaneous: {
				requestPermission: vi.fn().mockResolvedValue({ permission: 'denied' }),
			},
		}

		await expect(requestPermission(client as never)).rejects.toThrow('Permission denied')
	})

	it('returns ankiUnreachable when fetch fails', async () => {
		const client = {
			miscellaneous: {
				requestPermission: vi.fn().mockRejectedValue(new Error('fetch failed')),
			},
		}

		const result = await requestPermission(client as never)
		expect(result).toBe('ankiUnreachable')
	})

	it('returns ankiUnreachable when connection is refused', async () => {
		const client = {
			miscellaneous: {
				requestPermission: vi.fn().mockRejectedValue(new Error('net::ERR_CONNECTION_REFUSED')),
			},
		}

		const result = await requestPermission(client as never)
		expect(result).toBe('ankiUnreachable')
	})

	it('rethrows other errors', async () => {
		const client = {
			miscellaneous: {
				requestPermission: vi.fn().mockRejectedValue(new Error('some other error')),
			},
		}

		await expect(requestPermission(client as never)).rejects.toThrow('some other error')
	})
})

describe('syncToAnkiWeb', () => {
	it('calls sync on client', async () => {
		const client = {
			miscellaneous: {
				sync: vi.fn(),
			},
		}

		await syncToAnkiWeb(client as never)
		expect(client.miscellaneous.sync).toHaveBeenCalled()
	})

	it('handles sync failure gracefully', async () => {
		const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()

		const client = {
			miscellaneous: {
				sync: vi.fn().mockRejectedValue(new Error('offline')),
			},
		}

		await syncToAnkiWeb(client as never)
		expect(spyWarn).toHaveBeenCalled()
		spyWarn.mockRestore()
	})
})

// `null` here matches Anki-Connect's wire shape for `multi()` responses; the
// production code (`MultiActionResponse` in anki-connect.ts) uses the same form.
const DECK_QUERY_PATTERN = /^"deck:(.+)"$/

describe('getRemoteNotes', () => {
	it('returns empty array when no notes found', async () => {
		const client = {
			note: {
				findNotes: vi.fn().mockResolvedValue([]),
				notesInfo: vi.fn().mockResolvedValue([]),
			},
		}

		const result = await getRemoteNotes(client as never, 'test-namespace')
		expect(result).toEqual([])
	})

	it('returns undefined for all-undefined notes without issuing batch calls', async () => {
		const multiMock = makeMultiMock({})
		const client = {
			miscellaneous: { multi: multiMock },
			note: {
				findNotes: vi.fn().mockResolvedValue([1, 2]),
				notesInfo: vi.fn().mockResolvedValue([{ noteId: undefined }, { noteId: undefined }]),
			},
		}

		const result = await getRemoteNotes(client as never, 'test-namespace')
		expect(result).toEqual([undefined, undefined])
		// Early-return path skips both Phase A and Phase B/C entirely
		expect(multiMock).not.toHaveBeenCalled()
	})

	it('maps notes with deck info correctly via Phase A only', async () => {
		const multiMock = makeMultiMock({
			getDeckConfig: () => ({ dyn: false }),
		})
		const client = {
			deck: {
				deckNames: vi.fn(),
				getDecks: vi.fn().mockResolvedValue({ TestDeck: [100] }),
			},
			miscellaneous: { multi: multiMock },
			note: {
				findNotes: vi.fn().mockResolvedValue([1]),
				notesInfo: vi.fn().mockResolvedValue([makeAnkiNote(1, [100])]),
			},
		}

		const result = await getRemoteNotes(client as never, 'test')
		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({
			deckName: 'TestDeck',
			fields: { Back: 'back-1', Front: 'front-1', YankiNamespace: 'test' },
			modelName: 'Yanki - Basic',
			noteId: 1,
		})
		// No filtered decks → never need deckNames or Phase B/C
		expect(client.deck.deckNames).not.toHaveBeenCalled()
		expect(multiMock).toHaveBeenCalledTimes(1)
		const firstCall = multiMock.mock.calls[0] as MultiCall | undefined
		expect(firstCall?.[0].actions).toEqual([
			{ action: 'getDeckConfig', params: { deck: 'TestDeck' }, version: 6 },
		])
	})

	it('handles undefined noteId in mixed results', async () => {
		const client = {
			deck: {
				getDecks: vi.fn().mockResolvedValue({ TestDeck: [100] }),
			},
			miscellaneous: { multi: makeMultiMock({ getDeckConfig: () => ({ dyn: false }) }) },
			note: {
				findNotes: vi.fn().mockResolvedValue([1, 2]),
				notesInfo: vi.fn().mockResolvedValue([makeAnkiNote(1, [100]), { noteId: undefined }]),
			},
		}

		const result = await getRemoteNotes(client as never, 'test')
		expect(result).toHaveLength(2)
		expect(result[0]).toBeDefined()
		expect(result[1]).toBeUndefined()
	})

	it('throws for unknown model name', async () => {
		const client = {
			deck: {
				getDecks: vi.fn().mockResolvedValue({ TestDeck: [100] }),
			},
			miscellaneous: { multi: makeMultiMock({ getDeckConfig: () => ({ dyn: false }) }) },
			note: {
				findNotes: vi.fn().mockResolvedValue([1]),
				notesInfo: vi.fn().mockResolvedValue([
					{
						...makeAnkiNote(1, [100]),
						modelName: 'Unknown Model',
					},
				]),
			},
		}

		await expect(getRemoteNotes(client as never, 'test')).rejects.toThrow(
			'Unknown model name Unknown Model for note 1',
		)
	})

	it('throws when no deck found for cards', async () => {
		const client = {
			deck: {
				getDecks: vi.fn().mockResolvedValue({}),
			},
			miscellaneous: { multi: makeMultiMock({}) },
			note: {
				findNotes: vi.fn().mockResolvedValue([1]),
				notesInfo: vi.fn().mockResolvedValue([makeAnkiNote(1, [100])]),
			},
		}

		await expect(getRemoteNotes(client as never, 'test')).rejects.toThrow(
			'No deck found for cards in note 1',
		)
	})

	it('resolves filtered decks to their real non-filtered deck', async () => {
		const multiMock = makeMultiMock({
			findNotes({ query }) {
				return query === '"deck:RealDeck"' ? [1] : []
			},
			getDeckConfig({ deck }) {
				return { dyn: deck === 'FilteredDeck' ? 1 : false }
			},
		})
		const client = {
			deck: {
				deckNames: vi.fn().mockResolvedValue(['FilteredDeck', 'RealDeck', 'Default']),
				getDecks: vi.fn().mockResolvedValue({ FilteredDeck: [100] }),
			},
			miscellaneous: { multi: multiMock },
			note: {
				findNotes: vi.fn().mockResolvedValue([1]),
				notesInfo: vi.fn().mockResolvedValue([makeAnkiNote(1, [100])]),
			},
		}

		const result = await getRemoteNotes(client as never, 'test')
		expect(result[0]?.deckName).toBe('RealDeck')
	})

	it('resolves filtered notes to deepest matching deck (A::B::C, not A::B)', async () => {
		const noteIdsByDeck: Record<string, number[]> = {
			'A::B': [1],
			'A::B::C': [1],
			Default: [],
		}
		const multiMock = makeMultiMock({
			findNotes({ query }) {
				const match = DECK_QUERY_PATTERN.exec(String(query))
				if (match === null) {
					return []
				}

				const deckName = match[1]
				return Object.hasOwn(noteIdsByDeck, deckName) ? noteIdsByDeck[deckName] : []
			},
			getDeckConfig({ deck }) {
				return { dyn: deck === 'Filtered' ? 1 : false }
			},
		})
		const client = {
			deck: {
				deckNames: vi.fn().mockResolvedValue(['Filtered', 'A::B', 'A::B::C', 'Default']),
				getDecks: vi.fn().mockResolvedValue({ Filtered: [100] }),
			},
			miscellaneous: { multi: multiMock },
			note: {
				findNotes: vi.fn().mockResolvedValue([1]),
				notesInfo: vi.fn().mockResolvedValue([makeAnkiNote(1, [100])]),
			},
		}

		const result = await getRemoteNotes(client as never, 'test')
		expect(result[0]?.deckName).toBe('A::B::C')
	})

	it('falls through to Default when no other deck contains the filtered note', async () => {
		const multiMock = makeMultiMock({
			findNotes({ query }) {
				return query === '"deck:Default"' ? [1] : []
			},
			getDeckConfig({ deck }) {
				return { dyn: deck === 'Filtered' ? 1 : false }
			},
		})
		const client = {
			deck: {
				deckNames: vi.fn().mockResolvedValue(['Filtered', 'Other', 'Default']),
				getDecks: vi.fn().mockResolvedValue({ Filtered: [100] }),
			},
			miscellaneous: { multi: multiMock },
			note: {
				findNotes: vi.fn().mockResolvedValue([1]),
				notesInfo: vi.fn().mockResolvedValue([makeAnkiNote(1, [100])]),
			},
		}

		const result = await getRemoteNotes(client as never, 'test')
		expect(result[0]?.deckName).toBe('Default')
	})

	it('handles a sync mixing filtered and unfiltered notes', async () => {
		const multiMock = makeMultiMock({
			findNotes({ query }) {
				return query === '"deck:RealDeck"' ? [1] : []
			},
			getDeckConfig({ deck }) {
				return { dyn: deck === 'Filtered' ? 1 : false }
			},
		})
		const client = {
			deck: {
				deckNames: vi.fn().mockResolvedValue(['Filtered', 'RealDeck', 'PlainDeck', 'Default']),
				getDecks: vi.fn().mockResolvedValue({ Filtered: [100], PlainDeck: [200] }),
			},
			miscellaneous: { multi: multiMock },
			note: {
				findNotes: vi.fn().mockResolvedValue([1, 2]),
				notesInfo: vi.fn().mockResolvedValue([makeAnkiNote(1, [100]), makeAnkiNote(2, [200])]),
			},
		}

		const result = await getRemoteNotes(client as never, 'test')
		expect(result[0]?.deckName).toBe('RealDeck')
		expect(result[1]?.deckName).toBe('PlainDeck')
	})

	it('reuses the Phase C cache when multiple filtered notes share a parent', async () => {
		const findNotesByDeck = vi.fn(({ query }: { query: string }) =>
			query === '"deck:RealDeck"' ? [1, 2] : [],
		)
		const multiMock = makeMultiMock({
			findNotes({ query }) {
				return findNotesByDeck({ query: String(query) })
			},
			getDeckConfig({ deck }) {
				return { dyn: String(deck).startsWith('Filtered') ? 1 : false }
			},
		})
		const client = {
			deck: {
				deckNames: vi.fn().mockResolvedValue(['FilteredA', 'FilteredB', 'RealDeck', 'Default']),
				getDecks: vi.fn().mockResolvedValue({ FilteredA: [100], FilteredB: [200] }),
			},
			miscellaneous: { multi: multiMock },
			note: {
				findNotes: vi.fn().mockResolvedValue([1, 2]),
				notesInfo: vi.fn().mockResolvedValue([makeAnkiNote(1, [100]), makeAnkiNote(2, [200])]),
			},
		}

		const result = await getRemoteNotes(client as never, 'test')
		expect(result[0]?.deckName).toBe('RealDeck')
		expect(result[1]?.deckName).toBe('RealDeck')
		// Confirms Phase C cache reuse — findNotes runs once per unfiltered deck
		// across the whole sync, never per-note.
		const realDeckCalls = findNotesByDeck.mock.calls.filter(
			(call) => call[0].query === '"deck:RealDeck"',
		)
		expect(realDeckCalls).toHaveLength(1)
	})

	it('throws when no matching non-filtered deck found', async () => {
		const multiMock = makeMultiMock({
			findNotes() {
				return []
			},
			getDeckConfig({ deck }) {
				return { dyn: deck === 'FilteredDeck' ? 1 : false }
			},
		})
		const client = {
			deck: {
				deckNames: vi.fn().mockResolvedValue(['FilteredDeck', 'Default']),
				getDecks: vi.fn().mockResolvedValue({ FilteredDeck: [100] }),
			},
			miscellaneous: { multi: multiMock },
			note: {
				findNotes: vi.fn().mockResolvedValue([1]),
				notesInfo: vi.fn().mockResolvedValue([makeAnkiNote(1, [100])]),
			},
		}

		await expect(getRemoteNotes(client as never, 'test')).rejects.toThrow(
			'No matching non-filtered deck found for note 1',
		)
	})

	it('probes the Default deck filter status alongside other decks', async () => {
		// Locks in Hardening G: Default is no longer special-cased, so Phase B
		// includes it in the getDeckConfig batch. If a future change reintroduces
		// the "Default is always unfiltered" assumption, this test will fail.
		const probedDecks: string[] = []
		const multiMock = makeMultiMock({
			findNotes() {
				return []
			},
			getDeckConfig({ deck }) {
				probedDecks.push(String(deck))
				return { dyn: deck === 'Filtered' ? 1 : false }
			},
		})
		const client = {
			deck: {
				deckNames: vi.fn().mockResolvedValue(['Filtered', 'RealDeck', 'Default']),
				getDecks: vi.fn().mockResolvedValue({ Filtered: [100] }),
			},
			miscellaneous: { multi: multiMock },
			note: {
				findNotes: vi.fn().mockResolvedValue([1]),
				notesInfo: vi.fn().mockResolvedValue([makeAnkiNote(1, [100])]),
			},
		}

		await expect(getRemoteNotes(client as never, 'test')).rejects.toThrow(
			'No matching non-filtered deck found for note 1',
		)
		expect(probedDecks).toContain('Default')
	})

	it('throws with deck context when getDeckConfig fails in Phase A', async () => {
		const multiMock = makeMultiMock({
			getDeckConfig({ deck }) {
				if (deck === 'TestDeck') {
					throw new Error('simulated AnkiConnect failure')
				}

				return { dyn: false }
			},
		})
		const client = {
			deck: {
				getDecks: vi.fn().mockResolvedValue({ TestDeck: [100] }),
			},
			miscellaneous: { multi: multiMock },
			note: {
				findNotes: vi.fn().mockResolvedValue([1]),
				notesInfo: vi.fn().mockResolvedValue([makeAnkiNote(1, [100])]),
			},
		}

		await expect(getRemoteNotes(client as never, 'test')).rejects.toThrow(
			'getDeckConfig failed for deck "TestDeck": simulated AnkiConnect failure',
		)
	})

	it('throws with deck context when findNotes fails in Phase C', async () => {
		const multiMock = makeMultiMock({
			findNotes({ query }) {
				if (query === '"deck:RealDeck"') {
					throw new Error('simulated findNotes failure')
				}

				return []
			},
			getDeckConfig({ deck }) {
				return { dyn: deck === 'Filtered' ? 1 : false }
			},
		})
		const client = {
			deck: {
				deckNames: vi.fn().mockResolvedValue(['Filtered', 'RealDeck', 'Default']),
				getDecks: vi.fn().mockResolvedValue({ Filtered: [100] }),
			},
			miscellaneous: { multi: multiMock },
			note: {
				findNotes: vi.fn().mockResolvedValue([1]),
				notesInfo: vi.fn().mockResolvedValue([makeAnkiNote(1, [100])]),
			},
		}

		await expect(getRemoteNotes(client as never, 'test')).rejects.toThrow(
			'findNotes failed for deck "RealDeck": simulated findNotes failure',
		)
	})

	it('throws a typed error when getDeckConfig returns a malformed shape', async () => {
		// eslint-disable-next-line unicorn/no-null
		const multiMock = vi.fn().mockResolvedValue([{ error: null, result: { name: 'TestDeck' } }])
		const client = {
			deck: {
				getDecks: vi.fn().mockResolvedValue({ TestDeck: [100] }),
			},
			miscellaneous: { multi: multiMock },
			note: {
				findNotes: vi.fn().mockResolvedValue([1]),
				notesInfo: vi.fn().mockResolvedValue([makeAnkiNote(1, [100])]),
			},
		}

		await expect(getRemoteNotes(client as never, 'test')).rejects.toThrow(
			'Expected { dyn: 1 | false } from getDeckConfig for deck "TestDeck"',
		)
	})

	it('chunks Phase A across multiple multi() calls when decks exceed chunk size', async () => {
		// Default chunk size is 25; 30 decks forces two chunks (25 + 5).
		const deckCount = 30
		const decks = Array.from(
			{ length: deckCount },
			(_, i) => `Deck${i.toString().padStart(2, '0')}`,
		)
		const cards = Array.from({ length: deckCount }, (_, i) => 100 + i)
		const deckToCards: Record<string, number[]> = {}
		for (const [i, deck] of decks.entries()) {
			deckToCards[deck] = [cards[i] ?? 0]
		}

		const multiMock = makeMultiMock({ getDeckConfig: () => ({ dyn: false }) })
		const client = {
			deck: {
				getDecks: vi.fn().mockResolvedValue(deckToCards),
			},
			miscellaneous: { multi: multiMock },
			note: {
				findNotes: vi.fn().mockResolvedValue(decks.map((_, i) => i + 1)),
				notesInfo: vi
					.fn()
					.mockResolvedValue(decks.map((_, i) => makeAnkiNote(i + 1, [cards[i] ?? 0]))),
			},
		}

		const result = await getRemoteNotes(client as never, 'test')
		expect(result).toHaveLength(deckCount)
		expect(multiMock).toHaveBeenCalledTimes(2)
		const chunkSizes = (multiMock.mock.calls as MultiCall[]).map((call) => call[0].actions.length)
		expect(chunkSizes).toEqual([25, 5])
		// Every deck is correctly assigned despite the chunk boundary
		for (const [i, entry] of result.entries()) {
			expect(entry.deckName).toBe(decks[i])
		}
	})
})

describe('deleteOrphanedDecks edge cases', () => {
	it('warns when multiple decks returned for a single name', async () => {
		const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()
		const client = {
			deck: {
				deleteDecks: vi.fn(),
				getDeckStats: vi.fn().mockResolvedValue({
					'OrphanDeck-1': { learn_count: 0, new_count: 0, review_count: 0, total_in_deck: 0 },
					'OrphanDeck-2': { learn_count: 0, new_count: 0, review_count: 0, total_in_deck: 0 },
				}),
			},
		}

		const activeNotes: YankiNote[] = []
		const originalNotes = [makeNote({ deckName: 'OrphanDeck' })]

		await deleteOrphanedDecks(client as never, activeNotes, originalNotes, false)
		expect(spyWarn).toHaveBeenCalledWith('Multiple decks found for deck name: OrphanDeck')
		spyWarn.mockRestore()
	})

	it('warns when deck stats returns empty for a deck', async () => {
		const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()
		const client = {
			deck: {
				deleteDecks: vi.fn(),
				getDeckStats: vi.fn().mockResolvedValue({}),
			},
		}

		const activeNotes: YankiNote[] = []
		const originalNotes = [makeNote({ deckName: 'GhostDeck' })]

		await deleteOrphanedDecks(client as never, activeNotes, originalNotes, false)
		expect(spyWarn).toHaveBeenCalledWith('Deck not found for deck name: GhostDeck')
		spyWarn.mockRestore()
	})
})

describe('reconcileMedia', () => {
	it('returns empty results in dry run mode', async () => {
		const result = await reconcileMedia({} as never, [], 'test', true)
		expect(result).toEqual({
			deleted: [],
			failedDeletes: [],
			failedUploads: [],
			reuploaded: [],
		})
	})

	it('deletes orphaned media and re-uploads missing media', async () => {
		const multi = vi
			.fn()
			// eslint-disable-next-line unicorn/no-null
			.mockResolvedValueOnce([{ error: null, result: 'yanki-test-new-file.png' }])
			// eslint-disable-next-line unicorn/no-null
			.mockResolvedValueOnce([{ error: null, result: undefined }])
		const client = {
			media: {
				getMediaFilesNames: vi.fn().mockResolvedValue(['yanki-test-old-file.png']),
			},
			miscellaneous: { multi },
		}

		const notes = [
			makeNote({
				fields: {
					Back: '<img src="yanki-test-new-file.png" data-yanki-media-sync="true" data-yanki-media-src="http://example.com/img.png">',
					Front: 'front',
					YankiNamespace: 'test',
				},
			}),
		]

		const result = await reconcileMedia(client as never, notes, 'test', false)
		expect(result.deleted).toContain('yanki-test-old-file.png')

		const deleteCall = multi.mock.calls.find((call) =>
			(call[0] as { actions: Array<{ action: string }> }).actions.some(
				(a) => a.action === 'deleteMediaFile',
			),
		)
		expect(deleteCall).toBeDefined()
	})

	it('warns when no file adapter for local media re-upload', async () => {
		const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()
		const client = {
			media: {
				getMediaFilesNames: vi.fn().mockResolvedValue([]),
			},
			miscellaneous: { multi: vi.fn().mockResolvedValue([]) },
		}

		const notes = [
			makeNote({
				fields: {
					Back: '<img src="yanki-test-file.png" data-yanki-media-sync="true" data-yanki-media-src="/local/file.png">',
					Front: 'front',
					YankiNamespace: 'test',
				},
			}),
		]

		await reconcileMedia(client as never, notes, 'test', false)
		expect(spyWarn).toHaveBeenCalledWith(expect.stringContaining('no file adapter provided'))
		spyWarn.mockRestore()
	})

	it('handles re-upload errors gracefully', async () => {
		const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()
		const client = {
			media: {
				getMediaFilesNames: vi.fn().mockResolvedValue([]),
			},
			miscellaneous: {
				multi: vi.fn().mockResolvedValue([{ error: 'network error', result: undefined }]),
			},
		}

		const notes = [
			makeNote({
				fields: {
					Back: '<img src="yanki-test-file.png" data-yanki-media-sync="true" data-yanki-media-src="http://example.com/img.png">',
					Front: 'front',
					YankiNamespace: 'test',
				},
			}),
		]

		const result = await reconcileMedia(client as never, notes, 'test', false)
		expect(result.reuploaded).toEqual([])
		expect(spyWarn).toHaveBeenCalled()
		spyWarn.mockRestore()
	})

	it('re-uploads URL-based media successfully', async () => {
		// eslint-disable-next-line unicorn/no-null
		const multi = vi.fn().mockResolvedValue([{ error: null, result: 'yanki-test-file.png' }])
		const client = {
			media: {
				getMediaFilesNames: vi.fn().mockResolvedValue([]),
			},
			miscellaneous: { multi },
		}

		const notes = [
			makeNote({
				fields: {
					Back: '<img src="yanki-test-file.png" data-yanki-media-sync="true" data-yanki-media-src="http://example.com/img.png">',
					Front: 'front',
					YankiNamespace: 'test',
				},
				noteId: 42, // Not in freshWriteNoteIds — counts as reupload
			}),
		]

		const result = await reconcileMedia(client as never, notes, 'test', false)
		expect(result.reuploaded).toContain('yanki-test-file.png')
		expect(multi).toHaveBeenCalledWith({
			actions: [
				{
					action: 'storeMediaFile',
					params: {
						deleteExisting: true,
						filename: 'yanki-test-file.png',
						url: 'http://example.com/img.png',
					},
					version: 6,
				},
			],
		})
	})

	it('re-uploads local media with file adapter', async () => {
		// eslint-disable-next-line unicorn/no-null
		const multi = vi.fn().mockResolvedValue([{ error: null, result: 'yanki-test-file.png' }])
		const client = {
			media: {
				getMediaFilesNames: vi.fn().mockResolvedValue([]),
			},
			miscellaneous: { multi },
		}

		const fileAdapter = {
			readFileBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
		}

		const notes = [
			makeNote({
				fields: {
					Back: '<img src="yanki-test-file.png" data-yanki-media-sync="true" data-yanki-media-src="/local/file.png">',
					Front: 'front',
					YankiNamespace: 'test',
				},
				noteId: 42, // Not in freshWriteNoteIds — counts as reupload
			}),
		]

		const result = await reconcileMedia(client as never, notes, 'test', false, fileAdapter as never)
		expect(result.reuploaded).toContain('yanki-test-file.png')
		expect(multi).toHaveBeenCalledWith({
			actions: [
				{
					action: 'storeMediaFile',
					// eslint-disable-next-line ts/no-unsafe-assignment
					params: expect.objectContaining({
						// eslint-disable-next-line ts/no-unsafe-assignment
						data: expect.any(String),
						deleteExisting: true,
						filename: 'yanki-test-file.png',
					}),
					version: 6,
				},
			],
		})
		expect(fileAdapter.readFileBuffer).toHaveBeenCalledWith('/local/file.png')
	})

	it('omits failed uploads from the reuploaded list (silent partial failure)', async () => {
		const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()
		const multi = vi.fn().mockResolvedValue([
			// eslint-disable-next-line unicorn/no-null
			{ error: null, result: 'yanki-test-good.png' },
			{ error: 'disk full', result: undefined },
		])
		const client = {
			media: {
				getMediaFilesNames: vi.fn().mockResolvedValue([]),
			},
			miscellaneous: { multi },
		}
		const notes = [
			makeNote({
				fields: {
					Back: '<img src="yanki-test-good.png" data-yanki-media-sync="true" data-yanki-media-src="http://example.com/good.png"><img src="yanki-test-bad.png" data-yanki-media-sync="true" data-yanki-media-src="http://example.com/bad.png">',
					Front: 'front',
					YankiNamespace: 'test',
				},
				noteId: 42,
			}),
		]

		const result = await reconcileMedia(client as never, notes, 'test', false)
		expect(result.reuploaded).toEqual(['yanki-test-good.png'])
		expect(result.failedUploads).toEqual([{ filename: 'yanki-test-bad.png', reason: 'disk full' }])
		expect(spyWarn).toHaveBeenCalledWith(expect.stringContaining('yanki-test-bad.png'))
		spyWarn.mockRestore()
	})

	it('drops files that fail to read from disk; warns once', async () => {
		const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()
		// eslint-disable-next-line unicorn/no-null
		const multi = vi.fn().mockResolvedValue([{ error: null, result: undefined }])
		const fileAdapter = {
			readFileBuffer: vi.fn().mockImplementation(async (src: string): Promise<Uint8Array> => {
				await Promise.resolve()
				if (src === '/local/broken.png') {
					throw new Error('EACCES: permission denied')
				}

				return new Uint8Array([1, 2, 3])
			}),
		}
		const client = {
			media: {
				getMediaFilesNames: vi.fn().mockResolvedValue([]),
			},
			miscellaneous: { multi },
		}
		const notes = [
			makeNote({
				fields: {
					Back: '<img src="yanki-test-ok.png" data-yanki-media-sync="true" data-yanki-media-src="/local/ok.png"><img src="yanki-test-broken.png" data-yanki-media-sync="true" data-yanki-media-src="/local/broken.png">',
					Front: 'front',
					YankiNamespace: 'test',
				},
				noteId: 42,
			}),
		]

		const result = await reconcileMedia(client as never, notes, 'test', false, fileAdapter as never)
		// Only the readable file is uploaded
		expect(result.reuploaded).toEqual(['yanki-test-ok.png'])
		// Hardening B: the broken file is now visible in failedUploads instead of
		// being a console.warn-only signal.
		expect(result.failedUploads).toHaveLength(1)
		expect(result.failedUploads[0]?.filename).toBe('yanki-test-broken.png')
		expect(result.failedUploads[0]?.reason).toContain('EACCES')
		expect(spyWarn).toHaveBeenCalledWith(expect.stringContaining('yanki-test-broken.png'))
		spyWarn.mockRestore()
	})

	it('dedupes a media filename referenced by multiple fresh notes', async () => {
		// eslint-disable-next-line unicorn/no-null
		const multi = vi.fn().mockResolvedValue([{ error: null, result: 'yanki-test-shared.png' }])
		const client = {
			media: {
				getMediaFilesNames: vi.fn().mockResolvedValue([]),
			},
			miscellaneous: { multi },
		}
		const sharedHtml =
			'<img src="yanki-test-shared.png" data-yanki-media-sync="true" data-yanki-media-src="http://example.com/shared.png">'
		const notes = [
			makeNote({
				fields: { Back: sharedHtml, Front: 'a', YankiNamespace: 'test' },
				noteId: 1,
			}),
			makeNote({
				fields: { Back: sharedHtml, Front: 'b', YankiNamespace: 'test' },
				noteId: 2,
			}),
		]

		const result = await reconcileMedia(
			client as never,
			notes,
			'test',
			false,
			undefined,
			new Set([1, 2]),
		)
		// Single multi() call with one storeMediaFile action
		const call = multi.mock.calls[0]?.[0] as { actions: MultiActionInput[] }
		expect(call.actions).toHaveLength(1)
		// Both notes are fresh writes → silent upload, not in reuploaded
		expect(result.reuploaded).toEqual([])
	})

	it('chunks media uploads at the chunk-size boundary (>25 actions)', async () => {
		const fileCount = 26
		const filenames = Array.from(
			{ length: fileCount },
			(_, i) => `yanki-test-${i.toString().padStart(2, '0')}.png`,
		)
		const imgTags = filenames
			.map(
				(name, i) =>
					`<img src="${name}" data-yanki-media-sync="true" data-yanki-media-src="http://example.com/${i}.png">`,
			)
			.join('')

		const multi = vi
			.fn()
			.mockImplementation(async ({ actions }: { actions: MultiActionInput[] }) => {
				await Promise.resolve()
				return actions.map((action) => ({
					// eslint-disable-next-line unicorn/no-null
					error: null,
					result: (action.params as { filename?: string }).filename ?? '',
				}))
			})
		const client = {
			media: {
				getMediaFilesNames: vi.fn().mockResolvedValue([]),
			},
			miscellaneous: { multi },
		}
		const notes = [
			makeNote({
				fields: { Back: imgTags, Front: 'front', YankiNamespace: 'test' },
				noteId: 42,
			}),
		]

		const result = await reconcileMedia(client as never, notes, 'test', false)
		expect(result.reuploaded).toHaveLength(fileCount)
		expect(multi).toHaveBeenCalledTimes(2)
		const sizes = (multi.mock.calls as MultiCall[]).map((call) => call[0].actions.length)
		expect(sizes).toEqual([25, 1])
	})

	it('deletes orphaned media in chunks when count exceeds chunk size', async () => {
		const orphanedCount = 30
		const orphaned = Array.from(
			{ length: orphanedCount },
			(_, i) => `yanki-test-orphan-${i.toString().padStart(2, '0')}.png`,
		)
		const multi = vi
			.fn()
			.mockImplementation(async ({ actions }: { actions: MultiActionInput[] }) => {
				await Promise.resolve()
				// eslint-disable-next-line unicorn/no-null
				return actions.map(() => ({ error: null, result: undefined }))
			})
		const client = {
			media: {
				getMediaFilesNames: vi.fn().mockResolvedValue(orphaned),
			},
			miscellaneous: { multi },
		}

		const result = await reconcileMedia(client as never, [], 'test', false)
		expect(result.deleted).toHaveLength(orphanedCount)
		// 30 deletes split as 25 + 5
		const sizes = (multi.mock.calls as MultiCall[]).map((call) => call[0].actions.length)
		expect(sizes).toEqual([25, 5])
	})
})

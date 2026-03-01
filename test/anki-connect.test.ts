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

	it('returns undefined for all-undefined notes', async () => {
		const client = {
			note: {
				findNotes: vi.fn().mockResolvedValue([1, 2]),
				notesInfo: vi.fn().mockResolvedValue([{ noteId: undefined }, { noteId: undefined }]),
			},
		}

		const result = await getRemoteNotes(client as never, 'test-namespace')
		expect(result).toEqual([undefined, undefined])
	})

	it('maps notes with deck info correctly', async () => {
		const client = {
			deck: {
				getDeckConfig: vi.fn().mockResolvedValue({ dyn: 0 }),
				getDecks: vi.fn().mockResolvedValue({ TestDeck: [100] }),
			},
			note: {
				findNotes: vi.fn().mockResolvedValue([1]),
				notesInfo: vi.fn().mockResolvedValue([
					{
						cards: [100],
						fields: {
							Back: { value: 'back' },
							Front: { value: 'front' },
							YankiNamespace: { value: 'test' },
						},
						modelName: 'Yanki - Basic',
						noteId: 1,
						tags: ['tag1'],
					},
				]),
			},
		}

		const result = await getRemoteNotes(client as never, 'test')
		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({
			deckName: 'TestDeck',
			fields: { Back: 'back', Front: 'front', YankiNamespace: 'test' },
			modelName: 'Yanki - Basic',
			noteId: 1,
		})
	})

	it('handles undefined noteId in mixed results', async () => {
		const client = {
			deck: {
				getDeckConfig: vi.fn().mockResolvedValue({ dyn: 0 }),
				getDecks: vi.fn().mockResolvedValue({ TestDeck: [100] }),
			},
			note: {
				findNotes: vi.fn().mockResolvedValue([1, 2]),
				notesInfo: vi.fn().mockResolvedValue([
					{
						cards: [100],
						fields: {
							Back: { value: 'b' },
							Front: { value: 'f' },
							YankiNamespace: { value: 'test' },
						},
						modelName: 'Yanki - Basic',
						noteId: 1,
						tags: [],
					},
					{ noteId: undefined },
				]),
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
			note: {
				findNotes: vi.fn().mockResolvedValue([1]),
				notesInfo: vi.fn().mockResolvedValue([
					{
						cards: [100],
						fields: { Back: { value: '' }, Front: { value: '' }, YankiNamespace: { value: '' } },
						modelName: 'Unknown Model',
						noteId: 1,
						tags: [],
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
			note: {
				findNotes: vi.fn().mockResolvedValue([1]),
				notesInfo: vi.fn().mockResolvedValue([
					{
						cards: [100],
						fields: { Back: { value: '' }, Front: { value: '' }, YankiNamespace: { value: '' } },
						modelName: 'Yanki - Basic',
						noteId: 1,
						tags: [],
					},
				]),
			},
		}

		await expect(getRemoteNotes(client as never, 'test')).rejects.toThrow(
			'No deck found for cards in note 1',
		)
	})

	it('resolves filtered decks to their real non-filtered deck', async () => {
		const client = {
			deck: {
				deckNames: vi.fn().mockResolvedValue(['FilteredDeck', 'RealDeck', 'Default']),
				getDeckConfig: vi.fn().mockImplementation(({ deck }: { deck: string }) => {
					if (deck === 'FilteredDeck') return { dyn: 1 }
					return { dyn: 0 }
				}),
				getDecks: vi.fn().mockResolvedValue({ FilteredDeck: [100] }),
			},
			note: {
				findNotes: vi.fn().mockImplementation(({ query }: { query: string }) => {
					if (query === '"YankiNamespace:test"') return [1]
					if (query === '"deck:RealDeck"') return [1]
					if (query === '"deck:Default"') return []
					return []
				}),
				notesInfo: vi.fn().mockResolvedValue([
					{
						cards: [100],
						fields: {
							Back: { value: 'b' },
							Front: { value: 'f' },
							YankiNamespace: { value: 'test' },
						},
						modelName: 'Yanki - Basic',
						noteId: 1,
						tags: [],
					},
				]),
			},
		}

		const result = await getRemoteNotes(client as never, 'test')
		expect(result[0]?.deckName).toBe('RealDeck')
	})

	it('throws when no matching non-filtered deck found', async () => {
		const client = {
			deck: {
				deckNames: vi.fn().mockResolvedValue(['FilteredDeck', 'Default']),
				getDeckConfig: vi.fn().mockImplementation(({ deck }: { deck: string }) => {
					if (deck === 'FilteredDeck') return { dyn: 1 }
					return { dyn: 0 }
				}),
				getDecks: vi.fn().mockResolvedValue({ FilteredDeck: [100] }),
			},
			note: {
				findNotes: vi.fn().mockImplementation(({ query }: { query: string }) => {
					if (query === '"YankiNamespace:test"') return [1]
					return []
				}),
				notesInfo: vi.fn().mockResolvedValue([
					{
						cards: [100],
						fields: {
							Back: { value: 'b' },
							Front: { value: 'f' },
							YankiNamespace: { value: 'test' },
						},
						modelName: 'Yanki - Basic',
						noteId: 1,
						tags: [],
					},
				]),
			},
		}

		await expect(getRemoteNotes(client as never, 'test')).rejects.toThrow(
			'No matching non-filtered deck found for note 1',
		)
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
		expect(result).toEqual({ deleted: [], reuploaded: [] })
	})

	it('deletes orphaned media and re-uploads missing media', async () => {
		const client = {
			media: {
				deleteMediaFile: vi.fn(),
				getMediaFilesNames: vi.fn().mockResolvedValue(['yanki-test-old-file.png']),
				storeMediaFile: vi.fn(),
			},
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
		expect(client.media.deleteMediaFile).toHaveBeenCalledWith({
			filename: 'yanki-test-old-file.png',
		})
	})

	it('warns when no file adapter for local media re-upload', async () => {
		const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()
		const client = {
			media: {
				getMediaFilesNames: vi.fn().mockResolvedValue([]),
				storeMediaFile: vi.fn(),
			},
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
				storeMediaFile: vi.fn().mockRejectedValue(new Error('network error')),
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
		const client = {
			media: {
				getMediaFilesNames: vi.fn().mockResolvedValue([]),
				storeMediaFile: vi.fn(),
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
		expect(result.reuploaded).toContain('yanki-test-file.png')
		expect(client.media.storeMediaFile).toHaveBeenCalledWith(
			expect.objectContaining({ url: 'http://example.com/img.png' }),
		)
	})

	it('re-uploads local media with file adapter', async () => {
		const client = {
			media: {
				getMediaFilesNames: vi.fn().mockResolvedValue([]),
				storeMediaFile: vi.fn(),
			},
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
			}),
		]

		const result = await reconcileMedia(client as never, notes, 'test', false, fileAdapter as never)
		expect(result.reuploaded).toContain('yanki-test-file.png')
		expect(client.media.storeMediaFile).toHaveBeenCalledWith(
			// eslint-disable-next-line ts/no-unsafe-assignment
			expect.objectContaining({ data: expect.any(String) }),
		)
	})
})

/**
 * Regression tests for the parent-deck detection fix from
 * https://github.com/kitschpatrol/yanki/pull/7. The card search reports empty
 * decks to isolate candidate selection from the final emptiness check.
 */
import { describe, expect, it, vi } from 'vitest'
import type { YankiNote } from '../src/lib/model/note'
import { deleteOrphanedDecks } from '../src/lib/utilities/anki-connect'

function makeNote(deckName: string): YankiNote {
	return {
		deckName,
		fields: {
			Back: 'back',
			Front: 'front',
			YankiNamespace: 'test',
		},
		modelName: 'Yanki - Basic',
		noteId: 1,
		tags: [],
	}
}

/**
 * Create a mock client reporting empty decks and recording requested deletions.
 */
function createMockClient(deckNames: string[]) {
	const deletedDecks: string[] = []
	const client = {
		card: { findCards: vi.fn().mockResolvedValue([]) },
		deck: {
			deckNamesAndIds: vi
				.fn()
				.mockResolvedValue(Object.fromEntries(deckNames.map((name, index) => [name, index + 1]))),
			deleteDecks: vi.fn().mockImplementation(({ decks }: { decks: string[] }) => {
				deletedDecks.push(...decks)
			}),
		},
	}

	return { client, deletedDecks }
}

describe('deleteOrphanedDecks parent detection', () => {
	it('does not mark parent as orphan when sibling child is still active', async () => {
		const { client, deletedDecks } = createMockClient(['Lang', 'Lang::Grammar', 'Lang::Vocabulary'])

		const activeNotes = [makeNote('Lang::Grammar')]
		const originalNotes = [makeNote('Lang::Grammar'), makeNote('Lang::Vocabulary')]

		// With the old buggy code: "Lang".includes("Lang::Grammar") → false
		// → parent "Lang" incorrectly becomes an orphan candidate
		// → with unreliable getDeckStats returning 0, "Lang" gets deleted
		// → this cascades to delete "Lang::Grammar" too
		//
		// With the fix: "Lang::Grammar".startsWith("Lang::") → true
		// → parent "Lang" is correctly recognized as having active children
		await deleteOrphanedDecks(client as never, activeNotes, originalNotes, false)

		expect(deletedDecks).toContain('Lang::Vocabulary')
		expect(deletedDecks).not.toContain('Lang')
		expect(deletedDecks).not.toContain('Lang::Grammar')
	})

	it('marks parent as orphan when no children are active', async () => {
		const { client, deletedDecks } = createMockClient(['Lang', 'Lang::Grammar', 'Lang::Vocabulary'])

		const activeNotes: YankiNote[] = []
		const originalNotes = [makeNote('Lang::Grammar'), makeNote('Lang::Vocabulary')]

		const decksToDelete = await deleteOrphanedDecks(
			client as never,
			activeNotes,
			originalNotes,
			false,
		)

		// Both children orphaned, parent should also be a deletion candidate
		expect(decksToDelete).toEqual(['Lang', 'Lang::Grammar', 'Lang::Vocabulary'])

		// Anki removes children with their parent, and AnkiConnect 26.x fails a
		// request that names a deck an earlier entry already removed, so only
		// the parent is sent
		expect(deletedDecks).toEqual(['Lang'])
	})

	it('handles deeply nested decks correctly', async () => {
		const { client, deletedDecks } = createMockClient(['A', 'A::B', 'A::B::C', 'A::B::D'])

		const activeNotes = [makeNote('A::B::C')]
		const originalNotes = [makeNote('A::B::C'), makeNote('A::B::D')]

		await deleteOrphanedDecks(client as never, activeNotes, originalNotes, false)

		// A::B::D is orphaned, but A::B and A still have active child A::B::C
		expect(deletedDecks).toContain('A::B::D')
		expect(deletedDecks).not.toContain('A::B')
		expect(deletedDecks).not.toContain('A')
	})
})

/**
 * Unit test for the orphaned deck deletion logic, specifically the parent-deck
 * detection fix from https://github.com/kitschpatrol/yanki/pull/7
 *
 * The integration tests in sync.node.test.ts can't reliably exercise this bug
 * because the getDeckStats safety check catches the incorrect orphan candidates
 * in normal operation. The bug only manifests when getDeckStats returns
 * unreliable zero counts (an intermittent Anki issue). This test mocks the
 * Anki client to simulate that scenario.
 */
import { describe, expect, it } from 'vitest'
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
 * Create a mock YankiConnect client where getDeckStats always returns zero
 * counts (simulating the unreliable behavior documented in the source) and
 * deleteDecks records which decks were requested for deletion.
 */
function createMockClient() {
	const deletedDecks: string[] = []

	const client = {
		deck: {
			// eslint-disable-next-line ts/require-await
			async deleteDecks({ decks }: { cardsToo: boolean; decks: string[] }) {
				deletedDecks.push(...decks)
			},
			// eslint-disable-next-line ts/require-await
			async getDeckStats({ decks }: { decks: string[] }) {
				const result: Record<
					string,
					{
						learn_count: number
						new_count: number
						review_count: number
						total_in_deck: number
					}
				> = {}
				for (const deck of decks) {
					result[deck] = {
						learn_count: 0,
						new_count: 0,
						review_count: 0,
						total_in_deck: 0,
					}
				}

				return result
			},
		},
	}

	return { client, deletedDecks }
}

describe('deleteOrphanedDecks parent detection', () => {
	it('does not mark parent as orphan when sibling child is still active', async () => {
		const { client, deletedDecks } = createMockClient()

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
		const { client, deletedDecks } = createMockClient()

		const activeNotes: YankiNote[] = []
		const originalNotes = [makeNote('Lang::Grammar'), makeNote('Lang::Vocabulary')]

		await deleteOrphanedDecks(client as never, activeNotes, originalNotes, false)

		// Both children orphaned, parent should also be a deletion candidate
		expect(deletedDecks).toContain('Lang::Vocabulary')
		expect(deletedDecks).toContain('Lang::Grammar')
		expect(deletedDecks).toContain('Lang')
	})

	it('handles deeply nested decks correctly', async () => {
		const { client, deletedDecks } = createMockClient()

		const activeNotes = [makeNote('A::B::C')]
		const originalNotes = [makeNote('A::B::C'), makeNote('A::B::D')]

		await deleteOrphanedDecks(client as never, activeNotes, originalNotes, false)

		// A::B::D is orphaned, but A::B and A still have active child A::B::C
		expect(deletedDecks).toContain('A::B::D')
		expect(deletedDecks).not.toContain('A::B')
		expect(deletedDecks).not.toContain('A')
	})
})

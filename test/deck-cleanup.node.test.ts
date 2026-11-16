import { expect, it } from 'vitest'
import type { YankiNote } from '../src/lib/model/note'
import { cleanNotes, syncNotes } from '../src/lib'
import { describeWithFileFixture } from './fixtures/file-fixture'

describeWithFileFixture(
	'deck cleanup safety',
	{ assetPath: './test/assets/test-deck-safety' },
	(context) => {
		for (const operation of ['clean', 'sync'] as const) {
			it.each(['suspended', 'future-review', 'new'] as const)(
				`${operation} preserves unrelated %s cards in child decks`,
				async (state) => {
					const client = context.yankiConnect
					const parent = `Safety "${operation}" * ${state}`
					const managedDeck = `${parent}::Managed`
					const personalDeck = `${parent}::Personal::Nested`
					const options = {
						ankiConnectOptions: { autoLaunch: false },
						ankiWeb: false,
						namespace: context.namespace,
					}
					await client.deck.createDeck({ deck: personalDeck })
					const personalId = (await client.note.addNote({
						note: {
							deckName: personalDeck,
							fields: { Back: 'Unmanaged card', Front: parent },
							modelName: 'Basic',
						},
					}))!
					const cards = await client.card.findCards({ query: `nid:${personalId}` })
					if (state === 'suspended') {
						await client.card.suspend({ cards })
					} else if (state === 'future-review') {
						await client.card.setDueDate({ cards, days: '30!' })
					}

					const created = await syncNotes(
						[
							{
								deckName: managedDeck,
								fields: { Back: 'Managed note', Front: parent, YankiNamespace: context.namespace },
								modelName: 'Yanki - Basic (and reversed card with extra)',
								noteId: undefined,
							},
						],
						options,
					)
					const managedId = created.synced[0]!.note.noteId!
					expect(await client.card.findCards({ query: `nid:${managedId}` })).toHaveLength(2)
					const cleanup = async (dryRun: boolean) =>
						operation === 'clean'
							? cleanNotes({ ...options, dryRun })
							: syncNotes([], { ...options, dryRun })

					const preview = await cleanup(true)
					expect(preview.deletedDecks).toEqual([managedDeck])
					expect(
						await client.note.findNotes({ query: `nid:${personalId},${managedId}` }),
					).toHaveLength(2)
					const result = await cleanup(false)
					expect(result.deletedDecks).toEqual(preview.deletedDecks)
					expect(await client.note.findNotes({ query: `nid:${personalId}` })).toEqual([personalId])
					expect(await client.note.findNotes({ query: `nid:${managedId}` })).toEqual([])
					expect(await client.deck.deckNames()).toContain(personalDeck)
					expect(await client.deck.deckNames()).not.toContain(managedDeck)
				},
			)
		}
	},
)

describeWithFileFixture(
	'deck cleanup dry run parity',
	{ assetPath: './test/assets/test-deck-safety' },
	(context) => {
		it.each([
			{
				expected: ['Moved::Old'],
				from: 'Moved::Old',
				isSameNote: true,
				name: 'a note moving to a sibling deck',
				to: 'Moved::New',
			},
			{
				expected: ['Raised::Child'],
				from: 'Raised::Child',
				isSameNote: true,
				name: 'a note moving up into its parent deck',
				to: 'Raised',
			},
			{
				expected: ['Replaced::Child'],
				from: 'Replaced::Child',
				isSameNote: false,
				name: 'a new note in the parent of an orphaned deck',
				to: 'Replaced',
			},
			{
				expected: [],
				from: 'Extended',
				isSameNote: false,
				name: 'a new note in a child of an orphaned deck',
				to: 'Extended::Child',
			},
		])('previews the decks pruned by $name', async ({ expected, from, isSameNote, to }) => {
			const client = context.yankiConnect
			const options = {
				ankiConnectOptions: { autoLaunch: false },
				ankiWeb: false,
				namespace: context.namespace,
			}
			const makeNote = (deckName: string, content: string, noteId?: number): YankiNote => ({
				deckName,
				fields: { Back: `${content} back`, Front: content, YankiNamespace: context.namespace },
				modelName: 'Yanki - Basic (and reversed card with extra)',
				noteId,
			})

			const created = await syncNotes([makeNote(from, `${from} original`)], options)
			const originalId = created.synced[0]!.note.noteId!
			expect(await client.card.findCards({ query: `nid:${originalId}` })).toHaveLength(2)
			const nextNotes = [
				isSameNote
					? makeNote(to, `${from} original`, originalId)
					: makeNote(to, `${from} replacement`),
			]

			const preview = await syncNotes(nextNotes, { ...options, dryRun: true })
			expect(preview.deletedDecks).toEqual(expected)
			expect(await client.note.findNotes({ query: `nid:${originalId}` })).toEqual([originalId])
			expect(await client.deck.deckNames()).toContain(from)

			const result = await syncNotes(nextNotes, { ...options, dryRun: false })
			expect(result.deletedDecks).toEqual(expected)
			expect(await client.note.findNotes({ query: `nid:${originalId}` })).toEqual(
				isSameNote ? [originalId] : [],
			)
			const deckNames = await client.deck.deckNames()
			expect(deckNames).toContain(to)
			expect(deckNames.includes(from)).toBe(!expected.includes(from))
		})
	},
)

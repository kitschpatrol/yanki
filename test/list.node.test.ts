import { expect, it } from 'vitest'
import { formatListResult, listNotes, syncFiles } from '../src/lib'
import { PLATFORM } from '../src/lib/utilities/platform'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { closeAnki } from './utilities/anki-connect'
import { sortMultiline, stableNoteIds } from './utilities/stable-sync-results'

describeWithFileFixture(
	'list notes',
	{
		assetPath: './test/assets/test-minimal-notes/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('lists notes', async () => {
			await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				syncMediaAssets: 'off',
			})

			const result = await listNotes({
				ankiConnectOptions: {
					autoLaunch: true,
				},
				namespace: context.namespace,
			})

			expect(result.notes).toHaveLength(context.markdownFiles.length)
			expect(result.namespace).toBe(context.namespace)

			const formatted = formatListResult(result)

			expect(sortMultiline(stableNoteIds(formatted))).toMatchInlineSnapshot(`
				"Note ID XXXXXXXXXXXXX 
				Note ID XXXXXXXXXXXXX 
				Note ID XXXXXXXXXXXXX (Empty)
				Note ID XXXXXXXXXXXXX (Empty)
				Note ID XXXXXXXXXXXXX (Empty)
				Note ID XXXXXXXXXXXXX (Empty)
				Note ID XXXXXXXXXXXXX (Empty)
				Note ID XXXXXXXXXXXXX (Empty)
				Note ID XXXXXXXXXXXXX I look a lot like the thing you need to type...
				Note ID XXXXXXXXXXXXX I look a lot like the thing you need to type...
				Note ID XXXXXXXXXXXXX I look a lot like the thing you need to type...
				Note ID XXXXXXXXXXXXX I look a lot like the thing you need to type...
				Note ID XXXXXXXXXXXXX I'm a question to which there is no answer.
				Note ID XXXXXXXXXXXXX I'm question which is sometimes the answer
				Note ID XXXXXXXXXXXXX I'm question which is sometimes the answer
				Note ID XXXXXXXXXXXXX I'm the front of the card
				Note ID XXXXXXXXXXXXX I'm the front of the card
				Note ID XXXXXXXXXXXXX I'm the prompt
				Note ID XXXXXXXXXXXXX I'm the prompt
				Note ID XXXXXXXXXXXXX I'm the prompt
				Note ID XXXXXXXXXXXXX I'm the prompt
				Note ID XXXXXXXXXXXXX I'm the prompt
				Note ID XXXXXXXXXXXXX I'm the question
				Note ID XXXXXXXXXXXXX My frontmatter is empty.
				Note ID XXXXXXXXXXXXX This card has a {{c1::cloze}} or...
				Note ID XXXXXXXXXXXXX This card has a {{c1::cloze}} or...
				Note ID XXXXXXXXXXXXX This card has a {{c1::cloze}} or...
				Note ID XXXXXXXXXXXXX This card has a {{c1::emphasized but un-hinted...
				Note ID XXXXXXXXXXXXX {{c1::a lonely cloze}}
				Note ID XXXXXXXXXXXXX {{c1::cloze}} is the {{c2::start of the..."
			`)
		})
	},
)

it('throws if anki is closed', { skip: PLATFORM !== 'mac', timeout: 20_000 }, async () => {
	await closeAnki()

	await expect(
		listNotes({
			ankiConnectOptions: {
				autoLaunch: false,
			},
			// Random UUID, don't touch anything
			namespace: 'D2FCB6BB-7214-458C-82C6-1ECC7593656F',
		}),
	).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: Anki is unreachable. Is Anki running?]`)
})

it('tells the truth if no notes are found', async () => {
	const result = await listNotes({
		ankiConnectOptions: {
			autoLaunch: true,
		},
		namespace:
			// Random UUID, won't exist
			'B243F690-98A4-4DF3-A282-02E5824EB688',
	})

	expect(result.notes.length).toBe(0)

	const formatted = formatListResult(result)

	expect(formatted).toMatchInlineSnapshot(`"No notes found."`)
})

it('handles undefined options', { skip: PLATFORM !== 'mac', timeout: 20_000 }, async () => {
	await closeAnki()
	await expect(listNotes()).rejects.toThrowErrorMatchingInlineSnapshot(
		`[Error: Anki is unreachable. Is Anki running?]`,
	)
})

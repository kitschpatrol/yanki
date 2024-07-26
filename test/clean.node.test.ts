import { cleanNotes, formatCleanResult, listNotes, syncFiles } from '../src/lib'
import { PLATFORM } from '../src/lib/utilities/platform'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { closeAnki } from './utilities/close-anki'
import { stableNoteIds, stablePrettyMs } from './utilities/stable-sync-results'
import { expect, it } from 'vitest'

describeWithFileFixture(
	'clean notes',
	{
		assetPath: './test/assets/test-complex-tree-root-bare/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('cleans notes', async () => {
			await syncFiles(context.markdownFiles, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				syncMediaAssets: 'off',
			})

			// Dry run
			const dryRunResult = await cleanNotes({
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: true,
				namespace: context.namespace,
			})

			expect(dryRunResult.deletedNotes).toHaveLength(context.markdownFiles.length)
			expect(dryRunResult.dryRun).toBe(true)
			expect(dryRunResult.namespace).toBe(context.namespace)

			const dryRunFormatted = formatCleanResult(dryRunResult)
			expect(dryRunFormatted).toMatchInlineSnapshot(
				`"Will deleted 9 notes, 7 decks, and 0 media assets from Anki."`,
			)

			const ankiNotes = await listNotes({
				ankiConnectOptions: {
					autoLaunch: true,
				},
				namespace: context.namespace,
			})
			expect(ankiNotes.notes).toHaveLength(context.markdownFiles.length)

			// Real run
			const runResult = await cleanNotes({
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				namespace: context.namespace,
			})

			expect(runResult.deletedNotes).toHaveLength(context.markdownFiles.length)
			expect(runResult.dryRun).toBe(false)
			expect(runResult.namespace).toBe(context.namespace)

			const runFormatted = formatCleanResult(runResult)
			expect(stablePrettyMs(runFormatted)).toMatchInlineSnapshot(
				`"Successfully deleted 9 notes, 15 decks, and 0 media assets from Anki in XXX."`,
			)

			// Verbose report
			const runFormattedVerbose = formatCleanResult(runResult, true)
			expect(stablePrettyMs(stableNoteIds(runFormattedVerbose))).toMatchInlineSnapshot(`
				"Successfully deleted 9 notes, 15 decks, and 0 media assets from Anki in XXX.

				Deleted notes:
				  Note ID XXXXXXXXXXXXX I should be in the deck 'deep-contiguous'
				  Note ID XXXXXXXXXXXXX I should be in the deck 'another'
				  Note ID XXXXXXXXXXXXX I should be in the deck 'another'
				  Note ID XXXXXXXXXXXXX I should be in the deck 'within'
				  Note ID XXXXXXXXXXXXX I should be in the deck 'within'
				  Note ID XXXXXXXXXXXXX I should be in the deck 'within'
				  Note ID XXXXXXXXXXXXX I should be in the deck 'brother'
				  Note ID XXXXXXXXXXXXX I should be in the deck 'sister'
				  Note ID XXXXXXXXXXXXX I should be in the deck 'solo-note'

				Deleted decks:
				  deep-contiguous
				  deep-contiguous::within
				  deep-contiguous::within::within
				  deep-contiguous::within::within::within
				  deep-island::within::within::within
				  deep-non-contiguous::within::within
				  sibling-folders::brother
				  sibling-folders::sister
				  solo-note
				  deep-island::within::within
				  deep-island::within
				  deep-island
				  deep-non-contiguous::within
				  deep-non-contiguous
				  sibling-folders"
			`)

			const postCleanAnkiNotes = await listNotes({
				ankiConnectOptions: {
					autoLaunch: true,
				},
				namespace: context.namespace,
			})
			expect(postCleanAnkiNotes.notes).toHaveLength(0)

			// At which point, there's nothing to delete...
			const postCleanResult = await cleanNotes({
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				namespace: context.namespace,
			})
			expect(formatCleanResult(postCleanResult)).toMatchInlineSnapshot(`"Nothing to delete"`)
		})
	},
)

it('throws if anki is closed', { skip: PLATFORM !== 'mac', timeout: 20_000 }, async () => {
	await closeAnki()

	await expect(
		cleanNotes({
			ankiConnectOptions: {
				autoLaunch: false,
			},
			ankiWeb: false,
			// Don't touch anything
			namespace: 'D2FCB6BB-7214-458C-82C6-1ECC7593656F',
		}),
	).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: Anki is unreachable. Is Anki running?]`)
})

it('handles undefined options', { skip: PLATFORM !== 'mac', timeout: 20_000 }, async () => {
	await closeAnki()
	await expect(cleanNotes()).rejects.toThrowErrorMatchingInlineSnapshot(
		`[Error: Anki is unreachable. Is Anki running?]`,
	)
})

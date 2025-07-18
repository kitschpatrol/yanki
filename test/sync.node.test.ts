import { globby } from 'globby'
import fs from 'node:fs/promises'
import path from 'node:path'
import slash from 'slash'
import sortKeys from 'sort-keys'
import { expect, it } from 'vitest'
import { formatSyncFilesResult, getNoteFromMarkdown, syncFiles } from '../src/lib'
import { getAllFrontmatter, setNoteIdInFrontmatter } from '../src/lib/model/frontmatter'
import * as pathExtras from '../src/lib/utilities/path'
import { getUnicodeCodePoints } from '../src/lib/utilities/string'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { countLinesOfFrontmatter } from './utilities/frontmatter-counter'
import { stableNoteIds, stablePrettyMs, stableResults } from './utilities/stable-sync-results'

describeWithFileFixture(
	'model types',
	{
		assetPath: './test/assets/test-minimal-notes/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('correctly infers Anki model types from markdown', async () => {
			const results: Record<string, string> = {}
			for (const filePath of context.markdownFiles) {
				const markdown = await fs.readFile(filePath, 'utf8')
				const { modelName } = await getNoteFromMarkdown(markdown, {
					namespace: context.namespace,
				})
				results[path.posix.basename(filePath)] = modelName
			}

			expect(sortKeys(results, { deep: true })).toMatchInlineSnapshot(`
				{
				  "basic-and-reversed-card-with-extra.md": "Yanki - Basic (and reversed card with extra)",
				  "basic-and-reversed-card-with-no-back.md": "Yanki - Basic (and reversed card with extra)",
				  "basic-and-reversed-card-with-no-front.md": "Yanki - Basic (and reversed card with extra)",
				  "basic-and-reversed-card.md": "Yanki - Basic (and reversed card with extra)",
				  "basic-type-in-the-answer-with-empty-frontmatter.md": "Yanki - Basic (type in the answer)",
				  "basic-type-in-the-answer-with-frontmatter.md": "Yanki - Basic (type in the answer)",
				  "basic-type-in-the-answer-with-multiple-emphasis-and-ignored-answer-style.md": "Yanki - Basic (type in the answer)",
				  "basic-type-in-the-answer-with-multiple-emphasis.md": "Yanki - Basic (type in the answer)",
				  "basic-type-in-the-answer.md": "Yanki - Basic (type in the answer)",
				  "basic-with-back-and-no-front-with-empty-frontmatter.md": "Yanki - Basic",
				  "basic-with-back-and-no-front.md": "Yanki - Basic",
				  "basic-with-cloze-like-back-and-no-front.md": "Yanki - Basic",
				  "basic-with-empty-everything.md": "Yanki - Basic",
				  "basic-with-empty-frontmatter.md": "Yanki - Basic",
				  "basic-with-front-and-cloze-like-back.md": "Yanki - Basic",
				  "basic-with-front-and-no-back.md": "Yanki - Basic",
				  "basic-with-front-image-markdown-embed-and-no-back.md": "Yanki - Basic",
				  "basic-with-front-image-wiki-embed-and-no-back.md": "Yanki - Basic",
				  "basic-with-type-in-the-answer-like-back-and-no-front.md": "Yanki - Basic",
				  "basic-with-type-in-the-answer-like-front-and-no-back.md": "Yanki - Basic",
				  "basic-with-type-in-the-answer-like-single-line-with-empty-frontmatter.md": "Yanki - Basic",
				  "basic-with-type-in-the-answer-like-single-line-with-frontmatter.md": "Yanki - Basic",
				  "basic-with-type-in-the-answer-like-single-line.md": "Yanki - Basic",
				  "basic.md": "Yanki - Basic",
				  "cloze-with-extra-empty.md": "Yanki - Cloze",
				  "cloze-with-extra.md": "Yanki - Cloze",
				  "cloze-with-no-preamble.md": "Yanki - Cloze",
				  "cloze-with-nothing-else.md": "Yanki - Cloze",
				  "cloze-with-style.md": "Yanki - Cloze",
				  "cloze.md": "Yanki - Cloze",
				}
			`)
		})
	},
)

describeWithFileFixture(
	'unexpected formatting',
	{
		assetPath: './test/assets/test-unexpected-formatting/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('correctly infers Anki model types from markdown with unexpected formatting', async () => {
			const results: Record<string, string> = {}
			for (const filePath of context.markdownFiles) {
				const markdown = await fs.readFile(filePath, 'utf8')
				const { modelName } = await getNoteFromMarkdown(markdown, {
					namespace: context.namespace,
				})
				results[path.posix.basename(filePath)] = modelName
			}

			expect(sortKeys(results, { deep: true })).toMatchInlineSnapshot(`
				{
				  "basic-and-reversed-card-with-alternate-thematic-breaks.md": "Yanki - Basic (and reversed card with extra)",
				  "basic-and-reversed-card-with-confusing-setext-headline.md": "Yanki - Basic (and reversed card with extra)",
				  "basic-and-reversed-card-with-empty-front-and-frontmatter.md": "Yanki - Basic (and reversed card with extra)",
				  "basic-and-reversed-card-with-extra-thematic-break-dashes.md": "Yanki - Basic (and reversed card with extra)",
				  "basic-and-reversed-card-with-tight-spacing-and-frontmatter.md": "Yanki - Basic (and reversed card with extra)",
				  "basic-and-reversed-card-with-tight-spacing.md": "Yanki - Basic (and reversed card with extra)",
				  "basic-with-confusing-setext-headline.md": "Yanki - Basic",
				  "basic-with-empty-front-and-frontmatter.md": "Yanki - Basic",
				  "basic-with-tight-spacing-and-frontmatter.md": "Yanki - Basic",
				  "basic-with-tight-spacing.md": "Yanki - Basic",
				}
			`)
		})
	},
)

describeWithFileFixture(
	'basic synchronization',
	{
		assetPath: './test/assets/test-minimal-notes/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('synchronizes notes to anki and has the correct deck name', async () => {
			const results = await syncFiles(context.markdownFiles, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				syncMediaAssets: 'off',
			})

			// Check the stuff that's elided from the stable results snapshot
			expect(results.duration).toBeDefined()
			expect(results.duration).toBeGreaterThan(0)

			for (const synced of results.synced) {
				expect(synced.note.noteId).toBeDefined()
				expect(synced.note.noteId).toBeGreaterThan(0)

				expect(context.markdownFiles).toContain(synced.filePath)
			}

			expect(stableResults(results)).toMatchSnapshot()

			const deckNames = results.synced.map((syncInfo) => syncInfo.note.deckName)
			for (const deckName of deckNames) {
				expect(deckName).toBe(path.posix.basename(context.assetPath))
			}

			const syncFormatted = formatSyncFilesResult(results)
			expect(stablePrettyMs(syncFormatted)).toMatchInlineSnapshot(
				`"Successfully synced 30 notes to Anki in XXX."`,
			)

			// Verbose report
			const runFormattedVerbose = formatSyncFilesResult(results, true)
			expect(stablePrettyMs(stableNoteIds(runFormattedVerbose))).toMatchInlineSnapshot(`
				"Successfully synced 30 notes to Anki in XXX.

				Sync Summary:
				  Created: 30

				Sync Details:
				  Note ID 0 Created /test-minimal-notes/basic-and-reversed-card-with-extra.md
				  Note ID 0 Created /test-minimal-notes/basic-and-reversed-card-with-no-back.md
				  Note ID 0 Created /test-minimal-notes/basic-and-reversed-card-with-no-front.md
				  Note ID 0 Created /test-minimal-notes/basic-and-reversed-card.md
				  Note ID 0 Created /test-minimal-notes/basic-type-in-the-answer-with-empty-frontmatter.md
				  Note ID 0 Created /test-minimal-notes/basic-type-in-the-answer-with-frontmatter.md
				  Note ID 0 Created /test-minimal-notes/basic-type-in-the-answer-with-multiple-emphasis-and-ignored-answer-style.md
				  Note ID 0 Created /test-minimal-notes/basic-type-in-the-answer-with-multiple-emphasis.md
				  Note ID 0 Created /test-minimal-notes/basic-type-in-the-answer.md
				  Note ID 0 Created /test-minimal-notes/basic-with-back-and-no-front-with-empty-frontmatter.md
				  Note ID 0 Created /test-minimal-notes/basic-with-back-and-no-front.md
				  Note ID 0 Created /test-minimal-notes/basic-with-cloze-like-back-and-no-front.md
				  Note ID 0 Created /test-minimal-notes/basic-with-empty-everything.md
				  Note ID 0 Created /test-minimal-notes/basic-with-empty-frontmatter.md
				  Note ID 0 Created /test-minimal-notes/basic-with-front-and-cloze-like-back.md
				  Note ID 0 Created /test-minimal-notes/basic-with-front-and-no-back.md
				  Note ID 0 Created /test-minimal-notes/basic-with-front-image-markdown-embed-and-no-back.md
				  Note ID 0 Created /test-minimal-notes/basic-with-front-image-wiki-embed-and-no-back.md
				  Note ID 0 Created /test-minimal-notes/basic-with-type-in-the-answer-like-back-and-no-front.md
				  Note ID 0 Created /test-minimal-notes/basic-with-type-in-the-answer-like-front-and-no-back.md
				  Note ID 0 Created /test-minimal-notes/basic-with-type-in-the-answer-like-single-line-with-empty-frontmatter.md
				  Note ID 0 Created /test-minimal-notes/basic-with-type-in-the-answer-like-single-line-with-frontmatter.md
				  Note ID 0 Created /test-minimal-notes/basic-with-type-in-the-answer-like-single-line.md
				  Note ID 0 Created /test-minimal-notes/basic.md
				  Note ID 0 Created /test-minimal-notes/cloze-with-extra-empty.md
				  Note ID 0 Created /test-minimal-notes/cloze-with-extra.md
				  Note ID 0 Created /test-minimal-notes/cloze-with-no-preamble.md
				  Note ID 0 Created /test-minimal-notes/cloze-with-nothing-else.md
				  Note ID 0 Created /test-minimal-notes/cloze-with-style.md
				  Note ID 0 Created /test-minimal-notes/cloze.md"
			`)
		})

		it('writes anki note IDs to the markdown files frontmatter', async () => {
			for (const filePath of context.markdownFiles) {
				const markdown = await fs.readFile(filePath, 'utf8')

				const note = await getNoteFromMarkdown(markdown, { namespace: context.namespace })

				expect(note.noteId).toBeDefined()
				expect(note.noteId).toBeGreaterThan(0)
			}
		})
	},
)

describeWithFileFixture(
	'surplus frontmatter',
	{
		assetPath: './test/assets/test-surplus-frontmatter/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('preserves and merges unrelated surplus frontmatter', async () => {
			const results = await syncFiles(context.markdownFiles, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				syncMediaAssets: 'off',
			})
			expect(stableResults(results)).toMatchSnapshot()

			for (const filePath of context.markdownFiles) {
				const markdown = await fs.readFile(filePath, 'utf8')
				const note = await getNoteFromMarkdown(markdown, { namespace: context.namespace })
				expect(note.noteId).toBeDefined()
				expect(note.noteId).toBeGreaterThan(0)

				const allFrontmatter = await getAllFrontmatter(markdown)

				expect(allFrontmatter['more stuff']).toBeDefined()
				expect(allFrontmatter['more stuff']).toBeTypeOf('object')
				expect(allFrontmatter['more stuff']).toMatchSnapshot()
				expect(allFrontmatter.noteId).toBeDefined()
				expect(allFrontmatter.noteId).toBeGreaterThan(0)
				expect(allFrontmatter.something).toBeDefined()
				expect(allFrontmatter.something).toMatchSnapshot()
			}
		})
	},
)

describeWithFileFixture(
	'complex trees',
	{
		assetPath: './test/assets/test-complex-tree-root-note/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('makes the right decisions about deck naming with a file in the root', async () => {
			const results = await syncFiles(context.markdownFiles, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				syncMediaAssets: 'off',
			})

			// Log inline for legibility
			const pathToDeckMap: Record<string, string | undefined> = {}
			for (const synced of results.synced) {
				const cleanPath =
					synced.filePath === undefined
						? `(Note is in Anki, no file path available.)`
						: `/${path.posix.basename(context.assetPath)}${synced.filePath.split(path.posix.basename(context.assetPath), 2).pop() ?? ''}`
				pathToDeckMap[cleanPath] = synced.note.deckName
			}

			expect(sortKeys(pathToDeckMap, { deep: true })).toMatchInlineSnapshot(`
				{
				  "/test-complex-tree-root-note/basic.md": "test-complex-tree-root-note",
				  "/test-complex-tree-root-note/deep-contiguous/basic.md": "test-complex-tree-root-note::deep-contiguous",
				  "/test-complex-tree-root-note/deep-contiguous/within/basic.md": "test-complex-tree-root-note::deep-contiguous::within",
				  "/test-complex-tree-root-note/deep-contiguous/within/within/basic.md": "test-complex-tree-root-note::deep-contiguous::within::within",
				  "/test-complex-tree-root-note/deep-contiguous/within/within/within/basic.md": "test-complex-tree-root-note::deep-contiguous::within::within::within",
				  "/test-complex-tree-root-note/deep-island/within/within/within/basic.md": "test-complex-tree-root-note::deep-island::within::within::within",
				  "/test-complex-tree-root-note/deep-non-contiguous/within/within/basic.md": "test-complex-tree-root-note::deep-non-contiguous::within::within",
				  "/test-complex-tree-root-note/sibling-folders/brother/basic.md": "test-complex-tree-root-note::sibling-folders::brother",
				  "/test-complex-tree-root-note/sibling-folders/sister/basic.md": "test-complex-tree-root-note::sibling-folders::sister",
				  "/test-complex-tree-root-note/solo-note/basic.md": "test-complex-tree-root-note::solo-note",
				}
			`)

			expect(stableResults(results)).toMatchSnapshot()
		})
	},
)

describeWithFileFixture(
	'complex trees',
	{
		assetPath: './test/assets/test-complex-tree-root-bare/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('makes the right decisions about deck naming without a file in the root', async () => {
			const results = await syncFiles(context.markdownFiles, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				syncMediaAssets: 'off',
			})

			// Log inline for legibility
			const pathToDeckMap: Record<string, string | undefined> = {}
			for (const synced of results.synced) {
				const cleanPath =
					synced.filePath === undefined
						? `(Note is in Anki, no file path available.)`
						: `/${path.posix.basename(context.assetPath)}${synced.filePath.split(path.posix.basename(context.assetPath), 2).pop() ?? ''}`
				pathToDeckMap[cleanPath] = synced.note.deckName
			}

			expect(sortKeys(pathToDeckMap, { deep: true })).toMatchInlineSnapshot(`
				{
				  "/test-complex-tree-root-bare/deep-contiguous/basic.md": "deep-contiguous",
				  "/test-complex-tree-root-bare/deep-contiguous/within/basic.md": "deep-contiguous::within",
				  "/test-complex-tree-root-bare/deep-contiguous/within/within/basic.md": "deep-contiguous::within::within",
				  "/test-complex-tree-root-bare/deep-contiguous/within/within/within/basic.md": "deep-contiguous::within::within::within",
				  "/test-complex-tree-root-bare/deep-island/within/within/within/basic.md": "deep-island::within::within::within",
				  "/test-complex-tree-root-bare/deep-non-contiguous/within/within/basic.md": "deep-non-contiguous::within::within",
				  "/test-complex-tree-root-bare/sibling-folders/brother/basic.md": "sibling-folders::brother",
				  "/test-complex-tree-root-bare/sibling-folders/sister/basic.md": "sibling-folders::sister",
				  "/test-complex-tree-root-bare/solo-note/basic.md": "solo-note",
				}
			`)

			expect(stableResults(results)).toMatchSnapshot()
		})
	},
)

describeWithFileFixture(
	'update model',
	{
		assetPath: './test/assets/test-update-model/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('updates the model if it changes without destroying the note', async () => {
			// First sync
			const results = await syncFiles(context.markdownFiles, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			// Now change the synced note in a way that would require a model update

			const note = results.synced[0]

			expect(note.filePath).toBeDefined()
			const markdown = await fs.readFile(note.filePath!, 'utf8')
			const updatedMarkdown = markdown.replace(
				"I'm the front of the card\n\n---",
				"I'm the front of the card\n\n---\n---",
			)

			await fs.writeFile(note.filePath!, updatedMarkdown)

			// Second sync
			const newModelResults = await syncFiles(context.markdownFiles, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			const newNote = newModelResults.synced[0]

			expect(newNote.note.noteId).toEqual(note.note.noteId)
			expect(newNote.action).toEqual('updated')
			expect(newNote.note.modelName).toEqual('Yanki - Basic (and reversed card with extra)')
		})
	},
)

/**
 * https://github.com/kitschpatrol/yanki-obsidian/issues/34
 * Thank you to @N-ISOGE for reporting.
 */
describeWithFileFixture(
	'update model and deck simultaneously',
	{
		assetPath: './test/assets/test-update-model-deck/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('updates the model and changes its containing deck without creating duplicates', async () => {
			// First sync
			const results = await syncFiles(context.markdownFiles, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			// Now change the synced note in a way that would require a model and deck update
			const note = results.synced[0]
			expect(note.filePath).toBeDefined()
			const markdown = await fs.readFile(note.filePath!, 'utf8')
			const updatedMarkdown = markdown.replace(
				"I'm the front of the card\n\n---",
				"I'm the front of the card\n\n---\n---",
			)

			// Update note contents
			await fs.writeFile(note.filePath!, updatedMarkdown)

			// Move note to a new deck
			const newBazDirectory = path.join(context.tempAssetPath, 'baz')
			await fs.mkdir(newBazDirectory)
			const newFilePath = path.join(newBazDirectory, path.basename(note.filePath!))
			await fs.rename(note.filePath!, newFilePath)

			// Second sync
			// Update context
			const newFileList = await globby(`${pathExtras.normalize(context.tempAssetPath)}/**/*.md`, {
				absolute: true,
			})
			const newAllFileList = await globby(`${pathExtras.normalize(context.tempAssetPath)}/**/*`, {
				absolute: true,
			})

			const newModelResults = await syncFiles(newFileList, {
				allFilePaths: newAllFileList,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			const newNote = newModelResults.synced[0]

			expect(newNote.note.noteId).toEqual(note.note.noteId)
			expect(newNote.action).toEqual('updated')
			expect(newNote.note.deckName).toEqual('baz')
			expect(newNote.note.modelName).toEqual('Yanki - Basic (and reversed card with extra)')

			// Expect the same in Anki
			const ankiDecks = await context.yankiConnect.deck.getDeckStats({ decks: ['foo', 'baz'] })

			const fooCardCount = Object.values(ankiDecks).find(
				({ name }) => name === 'foo',
			)?.total_in_deck

			const bazCardCount = Object.values(ankiDecks).find(
				({ name }) => name === 'baz',
			)?.total_in_deck

			expect(fooCardCount, 'foo deck should be empty').toEqual(0)
			expect(bazCardCount, 'baz deck should have two cards').toEqual(2)
		})
	},
)

describeWithFileFixture(
	'fancy markdown',
	{
		assetPath: './test/assets/test-fancy-markdown/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('handles fancy markdown', async () => {
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				basePath: context.tempAssetPath,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(stableResults(results)).toMatchSnapshot()
		})
	},
)

describeWithFileFixture(
	'long frontmatter',
	{
		assetPath: './test/assets/test-long-frontmatter/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('handles long frontmatter non-destructively', async () => {
			// Saw some issues with frontmatter getting split into multiple lines after sync...
			const initialLinesOfFrontmatter = await countLinesOfFrontmatter(context.markdownFiles[0])

			const results = await syncFiles(context.markdownFiles, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(results.synced[0].filePath).toBeDefined()
			const postSyncLinesOfFrontmatter = await countLinesOfFrontmatter(results.synced[0].filePath!)

			// Make sure the number of frontmatter lines in the output matches the input
			expect(initialLinesOfFrontmatter).toEqual(postSyncLinesOfFrontmatter)
		})
	},
)

describeWithFileFixture(
	'idempotent syncing',
	{
		assetPath: './test/assets/test-minimal-notes/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('idempotent syncing', { timeout: 60_000 }, async () => {
			// First sync should be all "created"
			const results = await syncFiles(context.markdownFiles, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			const syncActions = [...new Set(results.synced.map((syncInfo) => syncInfo.action))]

			expect(syncActions).toMatchInlineSnapshot(`
				[
				  "created",
				]
			`)

			const secondSyncResults = await syncFiles(context.markdownFiles, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			const secondSyncActions = [
				...new Set(secondSyncResults.synced.map((syncInfo) => syncInfo.action)),
			]

			expect(secondSyncActions).toMatchInlineSnapshot(`
				[
				  "unchanged",
				]
			`)
		})
	},
)

describeWithFileFixture(
	'duplicate node ids',
	{
		assetPath: './test/assets/test-duplicate-node-ids/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('handles duplicate node ids for notes with different content gracefully', async () => {
			// First, sync the file so it comes back with an id

			const results = await syncFiles(context.markdownFiles, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(stableResults(results)).toMatchSnapshot()

			// Create a duplicate note with the same ID but different content
			const filePathWithId = context.markdownFiles[0]
			const originalFileContent = await fs.readFile(filePathWithId, 'utf8')
			const duplicateModifiedFileContent = originalFileContent.replace(
				'Replace me',
				'I am the duplicate',
			)
			await fs.writeFile(
				filePathWithId.replace('basic.md', 'a-duplicate.md'),
				duplicateModifiedFileContent,
			)

			// Sync again

			const newFileList = await globby(`${path.posix.dirname(slash(filePathWithId))}/*.md`)

			const resultsWithDuplicates = await syncFiles(newFileList, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			// TODO revisit these results
			console.log(resultsWithDuplicates)
		})
	},
)

describeWithFileFixture(
	'note id edge cases',
	{
		assetPath: './test/assets/test-note-ids/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('handles missing note IDs gracefully', async () => {
			// First, sync the file so they come back with an id
			const results = await syncFiles(context.markdownFiles, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			const ids = results.synced.map((synced) => synced.note.noteId)

			expect(
				results.synced.map((synced) => synced.action).every((action) => action === 'created'),
			).toBe(true)

			expect(stableResults(results)).toMatchSnapshot()

			// Erase all the note IDs
			for (const filePath of context.markdownFiles) {
				const markdown = await fs.readFile(filePath, 'utf8')
				const newMarkdown = await setNoteIdInFrontmatter(markdown, undefined)
				await fs.writeFile(filePath, newMarkdown)
			}

			// Sync again
			const results2 = await syncFiles(context.markdownFiles, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(
				results2.synced.map((synced) => synced.action).every((action) => action === 'matched'),
			).toBe(true)

			const ids2 = results2.synced.map((synced) => synced.note.noteId)

			expect(ids).toEqual(ids2)

			expect(stableResults(results2)).toMatchSnapshot()

			// Set random note ids
			for (const filePath of context.markdownFiles) {
				const markdown = await fs.readFile(filePath, 'utf8')
				const newMarkdown = await setNoteIdInFrontmatter(markdown, Math.floor(Math.random() * 1000))
				await fs.writeFile(filePath, newMarkdown)
			}

			// Sync again
			const results3 = await syncFiles(context.markdownFiles, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(
				results3.synced.map((synced) => synced.action).every((action) => action === 'matched'),
			).toBe(true)

			const ids3 = results3.synced.map((synced) => synced.note.noteId)

			expect(ids2).toEqual(ids3)

			expect(stableResults(results3)).toMatchSnapshot()
		})
	},
)

/**
 * Related to https://github.com/kitschpatrol/yanki-obsidian/issues/14
 * Thank you to @BrianRonin for the test files.
 *
 * Initially, there was an issue with decks being pruned despite containing
 * notes, due to unusual responses from the Anki-Connect deck stats method. this
 * was preventing notes from being created in a single pass.
 */
describeWithFileFixture(
	'unicode deck names and invalid note ids',
	{
		assetPath: './test/assets/test-deck-pruning',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('syncs as expected', { timeout: 60_000 }, async () => {
			// Sync
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(stableResults(results)).toMatchSnapshot()

			// Change all the note IDs to be invalid
			for (const filePath of context.markdownFiles) {
				const markdown = await fs.readFile(filePath, 'utf8')
				const updatedMarkdown = markdown.replace(/noteId: \d+/, 'noteId: 0')
				await fs.writeFile(filePath, updatedMarkdown)
			}

			// Sync 2
			// Do it again to check for stability
			const tempPath = path.posix.dirname(context.markdownFiles[0])
			const newFileList = await globby(`${pathExtras.normalize(tempPath)}/**/*.md`, {
				absolute: true,
			})
			const newAllFileList = await globby(`${pathExtras.normalize(tempPath)}/**/*`, {
				absolute: true,
			})

			const results2 = await syncFiles(newFileList, {
				allFilePaths: newAllFileList,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(stableResults(results2)).toMatchSnapshot()
		})
	},
)

/**
 * Related to https://github.com/kitschpatrol/yanki-obsidian/issues/13
 * Thank you to @aesculapa for the test cases.
 */
describeWithFileFixture(
	'unicode deck contents',
	{
		assetPath: './test/assets/test-unicode',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('creates notes with unicode as expected', { timeout: 60_000 }, async () => {
			// Sync
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'prompt',
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(results.synced.map((synced) => path.basename(synced.filePath ?? '')))
				.toMatchInlineSnapshot(`
				[
				  "Zoé (1).md",
				  "Zoé (2).md",
				  "Zoé (3).md",
				  "Zoé (4).md",
				]
			`)

			expect(
				results.synced.map((synced) =>
					String(getUnicodeCodePoints(path.basename(synced.filePath ?? '', '.md'))),
				),
			).toMatchInlineSnapshot(`
				[
				  "5a,6f,e9,20,28,31,29",
				  "5a,6f,e9,20,28,32,29",
				  "5a,6f,e9,20,28,33,29",
				  "5a,6f,e9,20,28,34,29",
				]
			`)

			expect(stableResults(results)).toMatchSnapshot()

			// Do it again to check for stability
			const tempPath = path.posix.dirname(context.markdownFiles[0])
			const newFileList = await globby(`${pathExtras.normalize(tempPath)}/**/*.md`, {
				absolute: true,
			})
			const newAllFileList = await globby(`${pathExtras.normalize(tempPath)}/**/*`, {
				absolute: true,
			})
			const results2 = await syncFiles(newFileList, {
				allFilePaths: newAllFileList,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'prompt',
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(results2.synced.map((synced) => path.basename(synced.filePath ?? '')))
				.toMatchInlineSnapshot(`
				[
				  "Zoé (1).md",
				  "Zoé (2).md",
				  "Zoé (3).md",
				  "Zoé (4).md",
				]
			`)

			expect(
				results2.synced.map((synced) =>
					String(getUnicodeCodePoints(path.basename(synced.filePath ?? '', '.md'))),
				),
			).toMatchInlineSnapshot(`
				[
				  "5a,6f,e9,20,28,31,29",
				  "5a,6f,e9,20,28,32,29",
				  "5a,6f,e9,20,28,33,29",
				  "5a,6f,e9,20,28,34,29",
				]
			`)

			expect(stableResults(results2)).toMatchSnapshot()
		})
	},
)

/**
 * Related to https://github.com/kitschpatrol/yanki-obsidian/issues/25
 * Thank you to @zhuzhige123 for the test case.
 */
describeWithFileFixture(
	'single string tag',
	{
		assetPath: './test/assets/test-tags',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('creates notes with single string tag as expected', { timeout: 60_000 }, async () => {
			// Sync
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'prompt',
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(stableResults(results)).toMatchSnapshot()

			const tags = await context.yankiConnect.note.getTags()
			expect(tags).toStrictEqual(['测试'])

			// Do it again to check for stability
			const tempPath = path.posix.dirname(context.markdownFiles[0])
			const newFileList = await globby(`${pathExtras.normalize(tempPath)}/**/*.md`, {
				absolute: true,
			})
			const newAllFileList = await globby(`${pathExtras.normalize(tempPath)}/**/*`, {
				absolute: true,
			})
			const results2 = await syncFiles(newFileList, {
				allFilePaths: newAllFileList,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'prompt',
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(stableResults(results2)).toMatchSnapshot()

			const tags2 = await context.yankiConnect.note.getTags()
			expect(tags2).toStrictEqual(['测试'])
		})
	},
)

/**
 * Related to https://github.com/kitschpatrol/yanki-obsidian/issues/20
 * Thank you to @Positron010 for the suggestion.
 */
describeWithFileFixture(
	'nested tags',
	{
		assetPath: './test/assets/test-tags-nested',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('creates nested tags in anki', { timeout: 60_000 }, async () => {
			// Sync
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'prompt',
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(stableResults(results)).toMatchSnapshot()

			const tags = await context.yankiConnect.note.getTags()
			expect(tags.sort()).toStrictEqual([
				'one::two::three::four',
				'other',
				'yes::maybe::no',
				'yes::no',
				'yes::no::maybe::so',
			])

			// Do it again to check for stability
			const tempPath = path.posix.dirname(context.markdownFiles[0])
			const newFileList = await globby(`${pathExtras.normalize(tempPath)}/**/*.md`, {
				absolute: true,
			})
			const newAllFileList = await globby(`${pathExtras.normalize(tempPath)}/**/*`, {
				absolute: true,
			})
			const results2 = await syncFiles(newFileList, {
				allFilePaths: newAllFileList,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'prompt',
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(stableResults(results2)).toMatchSnapshot()

			const tags2 = await context.yankiConnect.note.getTags()
			expect(tags2.sort()).toStrictEqual([
				'one::two::three::four',
				'other',
				'yes::maybe::no',
				'yes::no',
				'yes::no::maybe::so',
			])
		})
	},
)

/**
 * Related to https://github.com/kitschpatrol/yanki-obsidian/issues/44
 * Thank you to @99887 for identifying this issue.
 */
describeWithFileFixture(
	'mixed case tags',
	{
		assetPath: './test/assets/test-tags-case',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('treats tags as case insensitive', { timeout: 60_000 }, async () => {
			// Sync
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'off',
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			const actions = results.synced.map((r) => r.action)
			expect(actions).toMatchInlineSnapshot(`
				[
				  "created",
				  "created",
				]
			`)

			const obsidianTags = results.synced.flatMap((r) => r.note.tags)
			expect(obsidianTags).toMatchInlineSnapshot(`
				[
				  "foo::BAR::Baz",
				  "pleasant::canoe",
				  "foo::bar::baz",
				  "PLEASANT::CANOE",
				]
			`)

			const ankiTags = await context.yankiConnect.note.getTags()
			expect(ankiTags).toMatchInlineSnapshot(`
				[
				  "foo::BAR::Baz",
				  "pleasant::canoe",
				]
			`)

			// Do it again to check for stability
			const results2 = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'off',
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			const actions2 = results2.synced.map((r) => r.action)
			expect(actions2).toMatchInlineSnapshot(`
				[
				  "unchanged",
				  "unchanged",
				]
			`)

			const obsidianTags2 = results2.synced.flatMap((r) => r.note.tags)
			expect(obsidianTags2).toMatchInlineSnapshot(`
				[
				  "foo::BAR::Baz",
				  "pleasant::canoe",
				  "foo::bar::baz",
				  "PLEASANT::CANOE",
				]
			`)

			const ankiTags2 = await context.yankiConnect.note.getTags()
			expect(ankiTags2).toEqual(expect.arrayContaining(['foo::BAR::Baz', 'pleasant::canoe']))
		})
	},
)

/**
 * Related to https://github.com/kitschpatrol/yanki-obsidian/issues/28
 * Thanks to @fislysandi for reporting.
 * This bug was actually related to a missing RegEx escape in the Yanki Obsidian
 * plugin, but the test will remain here for avoidance of doubt.
 */
describeWithFileFixture(
	'brackets in path',
	{
		assetPath: './test/assets/test-[bracket]-path',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('syncs correctly with brackets in the file path', { timeout: 60_000 }, async () => {
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				basePath: context.tempAssetPath,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(stableResults(results)).toMatchSnapshot()
		})
	},
)

describeWithFileFixture(
	'dry run',
	{
		assetPath: './test/assets/test-minimal-notes',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('does not touch notes on a dry run', { timeout: 60_000 }, async () => {
			// Store original file contents for comparison
			const originalFileContents = new Map<string, string>()
			for (const filePath of context.markdownFiles) {
				const content = await fs.readFile(filePath, 'utf8')
				originalFileContents.set(filePath, content)
			}

			const results = await syncFiles(context.markdownFiles, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: true,
				namespace: context.namespace,
				syncMediaAssets: 'off',
			})

			// Check to make sure context.markdownFiles are unchanged
			for (const filePath of context.markdownFiles) {
				const currentContent = await fs.readFile(filePath, 'utf8')
				const originalContent = originalFileContents.get(filePath)
				expect(currentContent).toBe(originalContent)
			}

			// Verify we got results but no actual changes were made to Anki
			expect(results.synced.length).toBeGreaterThan(0)
			expect(results.dryRun).toBe(true)
		})
	},
)

/**
 * Attempt to reproduce https://github.com/kitschpatrol/yanki-obsidian/issues/46
 */
describeWithFileFixture(
	'deck safety',
	{
		assetPath: './test/assets/test-deck-safety',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('preserves existing mixed decks', { timeout: 60_000 }, async () => {
			// First, create existing deck outside of Yanki
			await context.yankiConnect.deck.createDeck({ deck: 'Test Deck' })

			// Add note to existing deck that's NOT managed by Yanki
			await context.yankiConnect.note.addNote({
				note: {
					deckName: 'Test Deck',
					fields: {
						Back: 'Existing test note back',
						Front: 'Existing test note front',
					},
					modelName: 'Basic',
				},
			})

			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				basePath: context.tempAssetPath,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(stableResults(results)).toMatchSnapshot()

			const deckStats = await context.yankiConnect.deck.getDeckStats({ decks: ['Test Deck'] })
			const totalInDeck = Object.entries(deckStats)[0][1].total_in_deck
			expect(totalInDeck).toBe(2)

			// Now delete the Yanki-managed note from the file system and sync again
			await fs.unlink(context.markdownFiles[0])
			context.markdownFiles.splice(0, 1)
			context.allFiles.splice(0, 1)

			const results2 = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				basePath: context.tempAssetPath,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(stableResults(results2)).toMatchSnapshot()

			// The existing note in the eponymous deck should still be there
			const deckStats2 = await context.yankiConnect.deck.getDeckStats({ decks: ['Test Deck'] })
			const totalInDeck2 = Object.entries(deckStats2)[0][1].total_in_deck
			expect(totalInDeck2).toBe(1)
		})
	},
)

/**
 * Another attempt to reproduce https://github.com/kitschpatrol/yanki-obsidian/issues/46
 * based on https://github.com/kitschpatrol/yanki-obsidian/issues/46#issuecomment-3086363899
 */
describeWithFileFixture(
	'deep deck safety',
	{
		assetPath: './test/assets/test-deep-deck-safety',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('preserves existing deeply nested mixed decks', { timeout: 60_000 }, async () => {
			// "I created three-level folders, which means three nested decks within each other."
			// Presumably in Obsidian...
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				basePath: context.tempAssetPath,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(stableResults(results)).toMatchSnapshot()

			// "In the third-level folder, I added another deck directly in Anki but not in the plugin."
			await context.yankiConnect.deck.createDeck({
				deck: 'Test Deck A::Test Deck B::Test Deck C::Test Deck D',
			})

			// "I added new cards to that Anki deck..." (Presumably in the Anki desktop app)
			await context.yankiConnect.note.addNote({
				note: {
					deckName: 'Test Deck A::Test Deck B::Test Deck C::Test Deck D',
					fields: {
						Back: 'New card from Anki desktop app back',
						Front: 'New card from Anki desktop app front',
					},
					modelName: 'Basic',
				},
			})

			// We should have a mix of notes from the plugin and the Anki desktop app
			const allNotes1 = await context.yankiConnect.note.findNotes({ query: '*' })
			expect(allNotes1.length).toBe(4)

			// "...and also added cards from the plugin."
			const testDeckDPath = path.join(
				context.tempAssetPath,
				'Test Deck A',
				'Test Deck B',
				'Test Deck C',
				'Test Deck D',
			)
			const newNotePath = path.join(testDeckDPath, 'basic.md')
			await fs.mkdir(testDeckDPath, { recursive: true })
			await fs.writeFile(
				newNotePath,
				'New card from Obsidian front\n---\nNew card from Obsidian back',
			)
			context.markdownFiles.push(newNotePath)
			context.allFiles.push(newNotePath)

			const results2 = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				basePath: context.tempAssetPath,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(stableResults(results2)).toMatchSnapshot()

			// We should have a mix of notes from the plugin and the Anki desktop app
			const allNotes2 = await context.yankiConnect.note.findNotes({ query: '*' })
			expect(allNotes2.length).toBe(5)

			// "Afterwards, I deleted the cards, and emptied the folders(notes deleted) as well." (Presumably in Obsidian?)
			context.markdownFiles = []
			context.allFiles = []

			const results3 = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				basePath: context.tempAssetPath,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'off',
			})

			expect(stableResults(results3)).toMatchSnapshot()

			// The note added manually in the Anki desktop app should still be there
			const allNotes3 = await context.yankiConnect.note.findNotes({ query: '*' })
			expect(allNotes3.length).toBe(1)
		})
	},
)

/**
 * Another attempt to reproduce https://github.com/kitschpatrol/yanki-obsidian/issues/46
 * based on https://github.com/kitschpatrol/yanki-obsidian/issues/46#issuecomment-3088775586
 */
describeWithFileFixture(
	'deepest deck safety',
	{
		assetPath: './test/assets/test-deepest-deck-safety',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it(
			'preserves existing deeply nested mixed decks with empty intermediate decks',
			{ timeout: 60_000 },
			async () => {
				// "Keep the middle-level folders empty and put the notes only in the leaf folders, basically the deepest folder..
				const results = await syncFiles(context.markdownFiles, {
					allFilePaths: context.allFiles,
					ankiConnectOptions: {
						autoLaunch: true,
					},
					ankiWeb: false,
					basePath: context.tempAssetPath,
					dryRun: false,
					namespace: context.namespace,
					obsidianVault: 'Vault',
					syncMediaAssets: 'off',
				})

				expect(stableResults(results)).toMatchSnapshot()

				// "Do not create this deck in plugin, only in anki"
				await context.yankiConnect.deck.createDeck({
					deck: 'Test Deck A::Test Deck B::Test Deck D',
				})

				// "I added new cards to that Anki deck..." (Presumably in the Anki desktop app)
				await context.yankiConnect.note.addNote({
					note: {
						deckName: 'Test Deck A::Test Deck B::Test Deck D',
						fields: {
							Back: 'New card from Anki desktop app back',
							Front: 'New card from Anki desktop app front',
						},
						modelName: 'Basic',
					},
				})

				// We should have a mix of notes from the plugin and the Anki desktop app
				const allNotes1 = await context.yankiConnect.note.findNotes({ query: '*' })
				expect(allNotes1.length).toBe(2)

				// Remove the note file created by yanki
				console.log(context.markdownFiles)
				console.log(context.allFiles)
				context.markdownFiles = []
				context.allFiles = []

				// Sync again
				const results2 = await syncFiles(context.markdownFiles, {
					allFilePaths: context.allFiles,
					ankiConnectOptions: {
						autoLaunch: true,
					},
					ankiWeb: false,
					basePath: context.tempAssetPath,
					dryRun: false,
					namespace: context.namespace,
					obsidianVault: 'Vault',
					syncMediaAssets: 'off',
				})

				expect(stableResults(results2)).toMatchSnapshot()

				// The note added manually in the Anki desktop app should still be there
				const allNotes2 = await context.yankiConnect.note.findNotes({ query: '*' })
				expect(allNotes2.length).toBe(1)
			},
		)
	},
)

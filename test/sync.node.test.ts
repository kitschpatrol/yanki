import { globby } from 'globby'
import fs from 'node:fs/promises'
import path from 'node:path'
import slash from 'slash'
import sortKeys from 'sort-keys'
import { expect, it } from 'vitest'
import { formatSyncFilesResult, getNoteFromMarkdown, syncFiles } from '../src/lib'
import { getAllFrontmatter } from '../src/lib/model/frontmatter'
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
		it('idempotent syncing', async () => {
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

/**
 * Related to:
 * https://github.com/kitschpatrol/yanki-obsidian/issues/14
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
 * Related to https://github.com/kitschpatrol/yanki-obsidian/issues/TK
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
 * Related to https://github.com/kitschpatrol/yanki-obsidian/issues/28
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

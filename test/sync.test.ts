import { getNoteFromMarkdown, syncFiles } from '../src/lib'
import { getAllFrontmatter } from '../src/lib/model/frontmatter'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { countLinesOfFrontmatter } from './utilities/frontmatter-counter'
import { stableResults } from './utilities/stable-sync-results'
import { globby } from 'globby'
import fs from 'node:fs/promises'
import path from 'node:path'
import sortKeys from 'sort-keys'
import { expect, it } from 'vitest'

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
			for (const filePath of context.files) {
				const markdown = await fs.readFile(filePath, 'utf8')
				const { modelName } = await getNoteFromMarkdown(markdown, {
					namespace: context.namespace,
				})
				results[path.basename(filePath)] = modelName
			}

			expect(sortKeys(results, { deep: true })).toMatchInlineSnapshot(`
				{
				  "basic-and-reversed-card-with-no-back.md": "Yanki - Basic (and reversed card)",
				  "basic-and-reversed-card-with-no-front.md": "Yanki - Basic (and reversed card)",
				  "basic-and-reversed-card.md": "Yanki - Basic (and reversed card)",
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
			for (const filePath of context.files) {
				const markdown = await fs.readFile(filePath, 'utf8')
				const { modelName } = await getNoteFromMarkdown(markdown, {
					namespace: context.namespace,
				})
				results[path.basename(filePath)] = modelName
			}

			expect(sortKeys(results, { deep: true })).toMatchInlineSnapshot(`
				{
				  "basic-and-reversed-card-with-alternate-thematic-breaks.md": "Yanki - Basic (and reversed card)",
				  "basic-and-reversed-card-with-confusing-setext-headline.md": "Yanki - Basic (and reversed card)",
				  "basic-and-reversed-card-with-empty-front-and-frontmatter.md": "Yanki - Basic (and reversed card)",
				  "basic-and-reversed-card-with-extra-thematic-break-dashes.md": "Yanki - Basic (and reversed card)",
				  "basic-and-reversed-card-with-tight-spacing-and-frontmatter.md": "Yanki - Basic (and reversed card)",
				  "basic-and-reversed-card-with-tight-spacing.md": "Yanki - Basic (and reversed card)",
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
	'media',
	{
		assetPath: './test/assets/test-media/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('adds media to anki when appropriate', { timeout: 60_000 }, async () => {
			const results = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				syncMediaAssets: 'local',
			})

			expect(stableResults(results)).toMatchSnapshot()
		})
	},
)

describeWithFileFixture(
	'remote media',
	{
		assetPath: './test/assets/test-media-remote/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('fetches and adds media urls to anki when appropriate', { timeout: 60_000 }, async () => {
			const results = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				syncMediaAssets: 'remote',
			})

			expect(stableResults(results)).toMatchSnapshot()
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
			const results = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				syncMediaAssets: 'none',
			})

			// Check the stuff that's elided from the stable results snapshot
			expect(results.duration).toBeDefined()
			expect(results.duration).toBeGreaterThan(0)

			for (const synced of results.synced) {
				expect(synced.note.noteId).toBeDefined()
				expect(synced.note.noteId).toBeGreaterThan(0)

				expect(context.files).toContain(synced.filePath)
			}

			expect(stableResults(results)).toMatchSnapshot()

			const deckNames = results.synced.map((syncInfo) => syncInfo.note.deckName)
			for (const deckName of deckNames) {
				expect(deckName).toBe(path.basename(context.assetPath))
			}
		})

		it('writes anki note IDs to the markdown files frontmatter', async () => {
			for (const filePath of context.files) {
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
			const results = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				syncMediaAssets: 'none',
			})
			expect(stableResults(results)).toMatchSnapshot()

			for (const filePath of context.files) {
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
			const results = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				syncMediaAssets: 'none',
			})

			// Log inline for legibility
			const pathToDeckMap: Record<string, string | undefined> = {}
			for (const synced of results.synced) {
				const cleanPath =
					synced.filePath === undefined
						? `(Note is in Anki, no file path.)`
						: `/${path.basename(context.assetPath)}${synced.filePath.split(path.basename(context.assetPath), 2).pop() ?? ''}`
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
			const results = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				syncMediaAssets: 'none',
			})

			// Log inline for legibility
			const pathToDeckMap: Record<string, string | undefined> = {}
			for (const synced of results.synced) {
				const cleanPath =
					synced.filePath === undefined
						? `(Note is in Anki, no file path.)`
						: `/${path.basename(context.assetPath)}${synced.filePath.split(path.basename(context.assetPath), 2).pop() ?? ''}`
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
			const results = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'none',
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
			const newModelResults = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'none',
			})

			const newNote = newModelResults.synced[0]

			expect(newNote.note.noteId).toEqual(note.note.noteId)
			expect(newNote.action).toEqual('updated')
			expect(newNote.note.modelName).toEqual('Yanki - Basic (and reversed card)')
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
			const results = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'none',
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
			const initialLinesOfFrontmatter = await countLinesOfFrontmatter(context.files[0])

			const results = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'none',
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
			const results = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'none',
			})

			const syncActions = [...new Set(results.synced.map((syncInfo) => syncInfo.action))]

			expect(syncActions).toMatchInlineSnapshot(`
				[
				  "created",
				]
			`)

			const secondSyncResults = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'none',
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
			const results = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'none',
			})

			expect(stableResults(results)).toMatchSnapshot()

			// Create a duplicate note with the same ID but different content
			const filePathWithId = context.files[0]
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

			const newFileList = await globby(`${path.dirname(filePathWithId)}/*.md`)

			const resultsWithDuplicates = await syncFiles(newFileList, {
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				obsidianVault: 'Vault',
				syncMediaAssets: 'none',
			})

			// TODO revisit these results
			console.log(resultsWithDuplicates)
		})
	},
)

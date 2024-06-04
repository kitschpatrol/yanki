import { getNoteFromMarkdown, syncFiles } from '../src/lib'
import { getAllFrontmatter } from '../src/lib/model/frontmatter'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { stableResults } from './utilities/stable-sync-results'
import fs from 'node:fs/promises'
import path from 'node:path'
import sortKeys from 'sort-keys'
import { expect, it } from 'vitest'

describeWithFileFixture(
	'model types',
	{
		assetPath: './test/assets/test-minimal-notes/',
		cleanUpAnki: true,
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
				  "cloze-with-style.md": "Yanki - Cloze",
				  "cloze.md": "Yanki - Cloze",
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
	},
	(context) => {
		it('synchronizes notes to anki and has he correct deck name', async () => {
			const results = await syncFiles(context.files, { namespace: context.namespace })

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
	},
	(context) => {
		it('preserves and merges unrelated surplus frontmatter', async () => {
			const results = await syncFiles(context.files, { namespace: context.namespace })
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
		assetPath: './test/assets/test-complex-tree/',
		cleanUpAnki: true,
	},
	(context) => {
		it('makes the right decisions about deck naming', async () => {
			const results = await syncFiles(context.files, { namespace: context.namespace })

			// Log inline for legibility
			const pathToDeckMap: Record<string, string | undefined> = {}
			for (const synced of results.synced) {
				const cleanPath =
					synced.filePath === undefined
						? `(Note is in Anki, no file path.)`
						: `/${path.basename(context.assetPath)}${synced.filePath.split(path.basename(context.assetPath), 2).pop() ?? ''}`
				pathToDeckMap[cleanPath] = synced.note.deckName
			}

			expect(pathToDeckMap).toMatchInlineSnapshot(`
				{
				  "/test-complex-tree/deep-contiguous/basic.md": "test-complex-tree::deep-contiguous",
				  "/test-complex-tree/deep-contiguous/within/basic.md": "test-complex-tree::deep-contiguous::within",
				  "/test-complex-tree/deep-contiguous/within/within/basic.md": "test-complex-tree::deep-contiguous::within::within",
				  "/test-complex-tree/deep-contiguous/within/within/within/basic.md": "test-complex-tree::deep-contiguous::within::within::within",
				  "/test-complex-tree/deep-island/within/within/within/basic.md": "test-complex-tree::deep-island::within::within::within",
				  "/test-complex-tree/deep-non-contiguous/within/within/basic.md": "test-complex-tree::deep-non-contiguous::within::within",
				  "/test-complex-tree/sibling-folders/brother/basic.md": "test-complex-tree::sibling-folders::brother",
				  "/test-complex-tree/sibling-folders/sister/basic.md": "test-complex-tree::sibling-folders::sister",
				  "/test-complex-tree/solo-note/basic.md": "test-complex-tree::solo-note",
				}
			`)

			expect(stableResults(results)).toMatchSnapshot()
		})
	},
)

describeWithFileFixture(
	'fancy markdown',
	{
		assetPath: './test/assets/test-fancy-markdown/',
		cleanUpAnki: true,
	},
	(context) => {
		it('handles fancy markdown', async () => {
			const results = await syncFiles(context.files, {
				namespace: context.namespace,
				obsidianVault: 'Vault',
			})

			expect(stableResults(results)).toMatchSnapshot()
		})
	},
)

describeWithFileFixture(
	'idempotent syncing',
	{
		assetPath: './test/assets/test-minimal-notes/',
		cleanUpAnki: true,
	},
	(context) => {
		it('idempotent syncing', async () => {
			// First sync should be all "created"
			const results = await syncFiles(context.files, {
				namespace: context.namespace,
				obsidianVault: 'Vault',
			})

			const syncActions = [...new Set(results.synced.map((syncInfo) => syncInfo.action))]

			expect(syncActions).toMatchInlineSnapshot(`
				[
				  "created",
				]
			`)

			const secondSyncResults = await syncFiles(context.files, {
				namespace: context.namespace,
				obsidianVault: 'Vault',
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

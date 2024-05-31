import { getNoteFromMarkdown, syncFiles } from '../src/lib'
import { getAllFrontmatter } from '../src/lib/model/frontmatter'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { stableResults } from './utilities/stable-sync-results'
import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { YankiConnect } from 'yanki-connect'

describe('anki connect actions', () => {
	it('finds cards with YankiNamespace fields', async () => {
		const client = new YankiConnect({ autoLaunchAnki: true })

		const allYankiNotes = await client.note.findNotes({ query: '"YankiNamespace:*"' })

		console.log('----------------------------------')
		console.log(allYankiNotes)

		const specificYankiNotes = await client.note.findNotes({
			query: '"YankiNamespace:Yanki Basic Sync Test"',
		})

		// 1717134423287
		// 1717134423387
		console.log('----------------------------------')
		console.log('----------------------------------')
		console.log(specificYankiNotes)
	})
})

describeWithFileFixture(
	'model types',
	{
		assetPath: './test/assets/minimal-notes/',
		cleanUpAnki: false,
		namespace: 'Yanki Model Type Test',
	},
	(context) => {
		it('correctly infers Anki model types from markdown', async () => {
			const results: Record<string, string> = {}
			for (const filePath of context.files) {
				const markdown = await fs.readFile(filePath, 'utf8')
				const { modelName } = await getNoteFromMarkdown(markdown, context.namespace)
				results[path.basename(filePath)] = modelName
			}

			expect(results).toMatchInlineSnapshot(`
				{
				  "basic-and-reversed-card.md": "YankiModelTypeTest - Basic (and reversed card)",
				  "basic-no-back.md": "YankiModelTypeTest - Basic",
				  "basic-type-in-the-answer.md": "YankiModelTypeTest - Basic (type in the answer)",
				  "basic.md": "YankiModelTypeTest - Basic",
				  "cloze-extra.md": "YankiModelTypeTest - Cloze",
				  "cloze.md": "YankiModelTypeTest - Cloze",
				}
			`)
		})
	},
)

describeWithFileFixture(
	'basic synchronization',
	{
		assetPath: './test/assets/minimal-notes/',
		cleanUpAnki: true,
		namespace: 'Yanki Basic Sync Test',
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
				const note = await getNoteFromMarkdown(markdown, context.namespace)

				expect(note.noteId).toBeDefined()
				expect(note.noteId).toBeGreaterThan(0)
			}
		})
	},
)

describeWithFileFixture(
	'surplus frontmatter',
	{
		assetPath: './test/assets/surplus-frontmatter/',
		cleanUpAnki: true,
		namespace: 'Yanki Surplus Frontmatter Test',
	},
	(context) => {
		it('preserves and merges unrelated surplus frontmatter', async () => {
			const results = await syncFiles(context.files, { namespace: context.namespace })
			expect(stableResults(results)).toMatchSnapshot()

			for (const filePath of context.files) {
				const markdown = await fs.readFile(filePath, 'utf8')
				const note = await getNoteFromMarkdown(markdown, context.namespace)
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
		assetPath: './test/assets/complex-tree/',
		cleanUpAnki: true,
		namespace: 'Yanki Complex Tree Test',
	},
	(context) => {
		it('makes the right decisions about deck naming', async () => {
			const results = await syncFiles(context.files, { namespace: context.namespace })

			// Log inline for legibility
			const pathToDeckMap: Record<string, string | undefined> = {}
			for (const synced of results.synced) {
				const cleanPath = `/${path.basename(context.assetPath)}${synced.filePath.split(path.basename(context.assetPath), 2).pop() ?? ''}`
				pathToDeckMap[cleanPath] = synced.note.deckName
			}

			expect(pathToDeckMap).toMatchInlineSnapshot(`
				{
				  "/complex-tree/deep-contiguous/basic.md": "deep-contiguous",
				  "/complex-tree/deep-contiguous/within/basic.md": "deep-contiguous::within",
				  "/complex-tree/deep-contiguous/within/within/basic.md": "deep-contiguous::within::within",
				  "/complex-tree/deep-contiguous/within/within/within/basic.md": "deep-contiguous::within::within::within",
				  "/complex-tree/deep-island/basic.md": "deep-island",
				  "/complex-tree/deep-island/within/within/within/basic.md": "deep-island::within::within::within",
				  "/complex-tree/deep-non-contiguous/within/within/basic.md": "within::within",
				  "/complex-tree/sibling-folders/brother/basic.md": "brother",
				  "/complex-tree/sibling-folders/sister/basic.md": "sister",
				  "/complex-tree/solo-note/basic.md": "solo-note",
				}
			`)

			expect(stableResults(results)).toMatchSnapshot()
		})
	},
)

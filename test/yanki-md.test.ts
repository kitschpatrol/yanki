import { getNoteFromMarkdown, syncFiles } from '../src/lib'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { stableResults } from './utilities/stable-sync-results'
import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'

describeWithFileFixture(
	'model types',
	{
		assetPath: './test/assets/minimal-notes/',
		cleanUpAnki: false,
		testModelPrefix: 'YankiModelTypeTest - ',
	},
	(context) => {
		it('correctly infers Anki model types from markdown', async () => {
			const results: Record<string, string> = {}
			for (const filePath of context.files) {
				const markdown = await fs.readFile(filePath, 'utf8')
				const { modelName } = await getNoteFromMarkdown(markdown, context.testModelPrefix)
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
		testModelPrefix: 'YankiBasicSyncTest - ',
	},
	(context) => {
		it('synchronizes notes to Anki', async () => {
			const results = await syncFiles(context.files, { modelPrefix: context.testModelPrefix })
			expect(stableResults(results)).toMatchSnapshot()
		})
	},
)

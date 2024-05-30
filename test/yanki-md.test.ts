import { getAnkiJsonFromMarkdown } from '../src/parse/parse'
import fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('anki model type from markdown', () => {
	it('correctly infers cloze type from markdown', async () => {
		const markdown = await fs.readFile('./test/assets/cloze.md', 'utf8')
		const { modelName } = await getAnkiJsonFromMarkdown(markdown)
		expect(modelName).toMatchInlineSnapshot(`"Yanki - Cloze"`)
	})

	it('correctly infers basic type from markdown', async () => {
		const markdown = await fs.readFile('./test/assets/basic.md', 'utf8')
		const { modelName } = await getAnkiJsonFromMarkdown(markdown)
		expect(modelName).toMatchInlineSnapshot(`"Yanki - Basic"`)

		const markdown2 = await fs.readFile('./test/assets/basic-no-back.md', 'utf8')
		const { modelName: modelName2 } = await getAnkiJsonFromMarkdown(markdown2)
		expect(modelName2).toMatchInlineSnapshot(`"Yanki - Basic"`)
	})

	it('correctly infers basic and reversed card type from markdown', async () => {
		const markdown = await fs.readFile('./test/assets/basic-and-reversed-card.md', 'utf8')
		const { modelName } = await getAnkiJsonFromMarkdown(markdown)
		expect(modelName).toMatchInlineSnapshot(`"Yanki - Basic (and reversed card)"`)
	})

	it('correctly infers type in the answer type from markdown', async () => {
		const markdown = await fs.readFile('./test/assets/basic-type-in-the-answer.md', 'utf8')
		const { modelName } = await getAnkiJsonFromMarkdown(markdown)
		expect(modelName).toMatchInlineSnapshot(`"Yanki - Basic (type in the answer)"`)
	})
})

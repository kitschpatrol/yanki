import { getNoteFromMarkdown } from '../src/lib/parse/parse'
import fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('anki model type from markdown', () => {
	it('correctly infers cloze type from markdown', async () => {
		const markdown = await fs.readFile('./test/assets/cloze.md', 'utf8')
		const { modelName } = await getNoteFromMarkdown(markdown)
		expect(modelName).toMatchInlineSnapshot(`"Yanki - Cloze"`)
	})

	it('correctly infers basic type from markdown', async () => {
		const markdown = await fs.readFile('./test/assets/basic.md', 'utf8')
		const { modelName } = await getNoteFromMarkdown(markdown)
		expect(modelName).toMatchInlineSnapshot(`"Yanki - Basic"`)

		const markdown2 = await fs.readFile('./test/assets/basic-no-back.md', 'utf8')
		const { modelName: modelName2 } = await getNoteFromMarkdown(markdown2)
		expect(modelName2).toMatchInlineSnapshot(`"Yanki - Basic"`)
	})

	it('correctly infers basic and reversed card type from markdown', async () => {
		const markdown = await fs.readFile('./test/assets/basic-and-reversed-card.md', 'utf8')
		const { modelName } = await getNoteFromMarkdown(markdown)
		expect(modelName).toMatchInlineSnapshot(`"Yanki - Basic (and reversed card)"`)
	})

	it('correctly infers type in the answer type from markdown', async () => {
		const markdown = await fs.readFile('./test/assets/basic-type-in-the-answer.md', 'utf8')
		const { modelName } = await getNoteFromMarkdown(markdown)
		expect(modelName).toMatchInlineSnapshot(`"Yanki - Basic (type in the answer)"`)
	})
})

// TODO
// import { syncNoteFiles } from './lib/sync/sync'
// import prettyMilliseconds from 'pretty-ms'

// const testPaths = [
// 	'./test/assets/cloze.md',
// 	'./test/assets/cloze-extra.md',
// 	'./test/assets/basic.md',
// 	'./test/assets/basic-no-back.md',
// 	'./test/assets/basic-and-reversed-card.md',
// 	'./test/assets/basic-type-in-the-answer.md',
// ]

// const result = await syncNoteFiles(testPaths)

// const checkedCount = result.synced.filter((note) => note.action === 'unchanged').length
// const updatedCount = result.synced.filter((note) => note.action === 'updated').length
// const created = result.synced.filter((note) =>
// 	['created', 'recreated'].includes(note.action),
// ).length

// console.log(
// 	`Created ${created}, updated ${updatedCount}, checked ${checkedCount}, deleted ${result.deleted.length} in ${prettyMilliseconds(result.duration)}`,
// )

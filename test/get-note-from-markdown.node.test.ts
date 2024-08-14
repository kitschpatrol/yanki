import { getNoteFromMarkdown } from '../src/lib'
import { permute } from './utilities/permute'
import { expect, it } from 'vitest'

// Function to remove undefined fields from an object
function stripUndefinedFields<T extends Record<string, unknown>>(object: T): T {
	return Object.fromEntries(Object.entries(object).filter(([_, v]) => v !== undefined)) as T
}

async function getNotesFromMarkdown(
	markdownVariations: string[],
	showOriginal = true,
): Promise<
	Array<{
		back?: string
		front: string
		original?: string
		type: string
	}>
> {
	const results: Array<{
		back?: string
		front: string
		original?: string
		type: string
	}> = []
	for (const markdown of markdownVariations) {
		const note = await getNoteFromMarkdown(markdown)
		results.push(
			stripUndefinedFields({
				back:
					note.fields.Back.length > 0
						? note.fields.Back.split('\n').slice(2, -1).join('\n')
						: undefined,
				front: note.fields.Front.split('\n').slice(2, -1).join('\n'),
				original: showOriginal ? markdown : undefined,
				type: note.modelName,
			}),
		)
	}

	return results
}

it('detects single cloze deletions in markdown', async () => {
	const validVariations = [
		'~~cloze content~~',
		' ~~cloze content~~ ',
		'~~_cloze content_~~',
		'~~**cloze content**~~',
		String.raw`~~$$ \sigma $$~~`,
		'~~[Link](https://example.com)~~',
		'~~![Tiny](https://storage.kitschpatrol.com/example-image-1)~~',
		'Some stuff before, then ~~cloze content~~',
		'Some stuff before, then ~~cloze content~~ and then some stuff after.',
		'Some stuff before, then ~~cloze content~~ and then some stuff after.',
		'# Heading\n\nSome stuff before, then ~~cloze content~~ and then some stuff after.\n\n---\n\nExtra',
	]

	const invalidVariations = [
		'~~ cloze content ~~',
		'~~cloze content ~~',
		'~~This is a \n\n multiline cloze deletion~~',
	]

	const validNotes = await getNotesFromMarkdown(validVariations)
	const invalidNotes = await getNotesFromMarkdown(invalidVariations)

	expect(validNotes).toMatchSnapshot()

	expect(invalidNotes).toMatchSnapshot()
})

it('detects multiple cloze deletions in markdown', async () => {
	const validVariations = [
		'~~cloze content~~ ~~cloze content~~',
		'Some stuff before, then ~~cloze content~~ and more ~~cloze content~~ and then some stuff after.',
		'Some stuff before, then ~~cloze content~~\n\nand more ~~cloze content~~ and then some stuff after.',
		'Some stuff before, then ~~cloze content~~\n\nand more ~~cloze content~~ and then some stuff after.\n\n---\n\nExtra',
	]

	const validNotes = await getNotesFromMarkdown(validVariations)

	expect(validNotes).toMatchSnapshot()
})

it('detects cloze hints in markdown', async () => {
	const validVariations = [
		'~~cloze content _hint_~~ ~~cloze content *hint*~~',
		'~~_cloze content_        _hint_~~',
		'~~_cloze content_ _**hint**_~~',
	]

	const invalidVariations = [
		'~~_cloze content_~~',
		'~~_cloze content_ _not hint_ not a hint~~',
		'~~_cloze content_ **_hint_**~~',
	]

	const validNotes = await getNotesFromMarkdown(validVariations)
	const invalidNotes = await getNotesFromMarkdown(invalidVariations)

	expect(validNotes).toMatchSnapshot()

	expect(invalidNotes).toMatchSnapshot()
})

it('treats leading digits as cloze numbers', async () => {
	const validVariations = permute(
		'~~',
		['(0)', '(1)', '(42)', '0 ', '1 ', '42 ', '0|', '1|', '42|', '0.', '1.', '42.'],
		[' ', '', '  ', ' 3', '3', ')', '|', '.'],
		['cloze content', '**cloze content**'],
		[' _hint_', ''],
		'~~',
	)

	const invalidVariations = [
		'~~**1** cloze content~~',
		'~~**1 cloze** content~~',
		'~~1cloze content~~',
		'~~-1 cloze content~~',
		'~~-1.4 cloze content~~',
	]

	const validNotes = await getNotesFromMarkdown(validVariations)
	const invalidNotes = await getNotesFromMarkdown(invalidVariations)

	expect(validNotes).toMatchSnapshot()

	expect(invalidNotes).toMatchSnapshot()
})

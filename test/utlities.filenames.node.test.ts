import { expect, it } from 'vitest'
import { getNoteFromMarkdown } from '../src/lib'
import { getSafeTitleForNote } from '../src/lib/utilities/filenames'

it('generates filename from a note with a cloze in the middle', async () => {
	const markdown = 'There is ~~a cloze~~ in the middle of this note'
	const note = await getNoteFromMarkdown(markdown)
	const prompt = getSafeTitleForNote(note, 'prompt', 1000)
	const response = getSafeTitleForNote(note, 'response', 1000)

	expect(prompt).toMatchInlineSnapshot(`"There is"`)
	expect(response).toMatchInlineSnapshot(`"a cloze"`)
})

it('generates filename from a note with a cloze at the start', async () => {
	const markdown = '~~There is a cloze~~ at the start of this note'
	const note = await getNoteFromMarkdown(markdown)
	const prompt = getSafeTitleForNote(note, 'prompt', 1000)
	const response = getSafeTitleForNote(note, 'response', 1000)

	expect(prompt).toMatchInlineSnapshot(`"at the start of this note"`)
	expect(response).toMatchInlineSnapshot(`"There is a cloze"`)
})

it('generates filename from a note with a cloze at the end', async () => {
	const markdown = 'There is a cloze at the ~~end of this note _with a hint_~~'
	const note = await getNoteFromMarkdown(markdown)
	const prompt = getSafeTitleForNote(note, 'prompt', 1000)
	const response = getSafeTitleForNote(note, 'response', 1000)

	expect(prompt).toMatchInlineSnapshot(`"There is a cloze at the"`)
	expect(response).toMatchInlineSnapshot(`"end of this note"`)
})

it('generates filename from a note that is all cloze', async () => {
	const markdown = '~~This whole note is a cloze~~'
	const note = await getNoteFromMarkdown(markdown)
	const prompt = getSafeTitleForNote(note, 'prompt', 1000)
	const response = getSafeTitleForNote(note, 'response', 1000)

	expect(prompt).toMatchInlineSnapshot(`"This whole note is a cloze"`)
	expect(response).toMatchInlineSnapshot(`"This whole note is a cloze"`)
})

it('generates filename from a note with multiple clozes', async () => {
	const markdown = 'This ~~note~~ has several ~~clozes~~ in it'
	const note = await getNoteFromMarkdown(markdown)
	const prompt = getSafeTitleForNote(note, 'prompt', 1000)
	const response = getSafeTitleForNote(note, 'response', 1000)

	expect(prompt).toMatchInlineSnapshot(`"This"`)
	expect(response).toMatchInlineSnapshot(`"note"`)
})

it('generates filename from a note with explicitly indexed clozes', async () => {
	const markdown = 'This ~~1 note~~ has several ~~1 clozes~~ in it'
	const note = await getNoteFromMarkdown(markdown)
	const prompt = getSafeTitleForNote(note, 'prompt', 1000)
	const response = getSafeTitleForNote(note, 'response', 1000)

	expect(prompt).toMatchInlineSnapshot(`"This"`)
	expect(response).toMatchInlineSnapshot(`"note"`)
})

// Via https://github.com/kitschpatrol/yanki-obsidian/issues/56
it('generates filename from a note with multiline clozes', async () => {
	const markdown = '_Example Note Category_\n\ntesting 1\n\n~~cloze 1~~\n'

	const note = await getNoteFromMarkdown(markdown)
	const prompt = getSafeTitleForNote(note, 'prompt', 1000)
	const response = getSafeTitleForNote(note, 'response', 1000)

	expect(prompt).toMatchInlineSnapshot(`"Example Note Category testing 1"`)
	expect(response).toMatchInlineSnapshot(`"cloze 1"`)
})

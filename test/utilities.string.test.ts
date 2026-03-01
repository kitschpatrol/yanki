import { expect, it } from 'vitest'
import { css, emptyIsUndefined, html, md } from '../src/lib/utilities/string'

it('formats html without excessive white space', () => {
	const content = 'Some text'
	const multiLineHtml = html`
		<div>
			<p>${content}</p>
		</div>
		<p></p>
	`

	expect(multiLineHtml).toMatchInlineSnapshot(`
		"<div>
			<p>Some text</p>
		</div>
		<p></p>"
	`)

	const singleLineHtml = html`<p>${content}</p>`
	expect(singleLineHtml).toMatchInlineSnapshot(`"<p>Some text</p>"`)
})

// These go last since the css`` template function messes up subsequent syntax highlighting...

it('formats css without excessive white space', () => {
	const content = 'arial'
	const multiLineCss = css`
		.card {
			font-family: ${content};
			font-size: 20px;
			text-align: center;
			color: black;
			background-color: white;
		}
	`

	expect(multiLineCss).toMatchInlineSnapshot(`
		".card {
			font-family: arial;
			font-size: 20px;
			text-align: center;
			color: black;
			background-color: white;
		}"
	`)

	// Wrapping in css`` template function messes up subsequent syntax highlighting...
	const singleLineCss = css`
		font-family: ${content};
	`
	expect(singleLineCss).toMatchInlineSnapshot(`"font-family: arial;"`)
})

it('formats md without excessive white space', () => {
	const content = 'world'
	const multiLineMd = md`
		# Hello
		${content}
	`

	expect(multiLineMd).toMatchInlineSnapshot(`
		"# Hello
		world"
	`)
})

it('returns undefined for undefined input in emptyIsUndefined', () => {
	// eslint-disable-next-line unicorn/no-useless-undefined
	expect(emptyIsUndefined(undefined)).toBeUndefined()
})

it('returns undefined for empty or whitespace-only strings in emptyIsUndefined', () => {
	expect(emptyIsUndefined('')).toBeUndefined()
	expect(emptyIsUndefined('   ')).toBeUndefined()
	expect(emptyIsUndefined('\t')).toBeUndefined()
})

it('returns the string for non-empty strings in emptyIsUndefined', () => {
	expect(emptyIsUndefined('hello')).toBe('hello')
	expect(emptyIsUndefined(' hello ')).toBe(' hello ')
})

import { css, html } from '../src/lib/utilities/string'
import { expect, it } from 'vitest'

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

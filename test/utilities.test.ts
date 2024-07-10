import { css, hostAndPortToUrl, html, urlToHostAndPort } from '../src/lib/utilities/string'
import { expect, it } from 'vitest'

it('converts from url to host and port and back', () => {
	const { host, port } = urlToHostAndPort('http://localhost:8765')

	expect(host).toBe('http://localhost')
	expect(port).toBe(8765)

	const url = hostAndPortToUrl(host, port)
	expect(url).toBe('http://localhost:8765')
})

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

	const singleLineCss = css`
		font-family: ${content};
	`
	expect(singleLineCss).toMatchInlineSnapshot(`"font-family: arial;"`)
})

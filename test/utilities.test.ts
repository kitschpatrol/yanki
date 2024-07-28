import { resolveFilePathOrUrl } from '../src/lib/utilities/resolve-file-path-or-url'
import { css, hostAndPortToUrl, html, urlToHostAndPort } from '../src/lib/utilities/string'
import { permute } from './utilities/permute'
import { globby } from 'globby'
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

	// Wrapping in css`` template function messes up subsequent syntax highlighting...
	const singleLineCss = `
		font-family: ${content};
	`
	expect(singleLineCss).toMatchInlineSnapshot(`"font-family: arial;"`)
})

it('resolves a relative file path', () => {
	expect(
		resolveFilePathOrUrl('./assets/test-obsidian-vault/test card.md', {
			cwd: '/base-path/cwd/',
		}),
	).toMatchInlineSnapshot(`"/base-path/cwd/assets/test-obsidian-vault/test card.md"`)
})

it('resolves a url-encoded relative file path', () => {
	expect(
		resolveFilePathOrUrl('./assets/test-obsidian-vault/test%20card.md', {
			cwd: '/base-path/cwd/',
		}),
	).toMatchInlineSnapshot(`"/base-path/cwd/assets/test-obsidian-vault/test card.md"`)
})

it('resolves a relative file path with intermediate relative paths', () => {
	expect(
		resolveFilePathOrUrl('./assets/test-obsidian-vault/../test-obsidian-vault/test card.md', {
			cwd: '/base-path/cwd/',
		}),
	).toMatchInlineSnapshot(`"/base-path/cwd/assets/test-obsidian-vault/test card.md"`)
})

it('resolves a relative file path without an extension', async () => {
	expect(
		resolveFilePathOrUrl('./assets/test-obsidian-vault/test card', {
			allFilePaths: await globby('./test/assets/test-obsidian-vault/**/*', { absolute: true }),
			cwd: '/base-path/cwd/',
			defaultExtension: 'md',
		}),
	).toMatchInlineSnapshot(`"/base-path/cwd/assets/test-obsidian-vault/test card.md"`)
})

it('resolves relative file paths', async () => {
	const allRelativeFilePaths = await globby('./test/assets/test-obsidian-vault/**/*')
	const allFilePaths = allRelativeFilePaths.map((filePath) =>
		filePath.replace('./', '/base-path/cwd/'),
	)

	const testPaths = permute(
		[
			'./test/assets/test-obsidian-vault/',
			'.\\test\\assets\\test-obsidian-vault\\',
			'../cwd/test/assets/test-obsidian-vault/',
			'..\\cwd\\test\\assets\\test-obsidian-vault\\',
		],
		['test card', 'test%20card'],
		['.md', ''],
		['^34876', '#bla', '#bla#bla', '?foo=bar', '?foo=bar%20baz', ''],
	)

	const resolvedTestPaths = [...testPaths].map((testPath) =>
		resolveFilePathOrUrl(testPath, {
			allFilePaths,
			cwd: '/base-path/cwd/',
			defaultExtension: 'md',
		}),
	)

	expect(
		allCorrect(
			testPaths,
			resolvedTestPaths,
			'/base-path/cwd/test/assets/test-obsidian-vault/test card.md',
		),
	).toBeTruthy()
})

function allCorrect(testPaths: string[], resolvedTestPaths: string[], test: string) {
	if (testPaths.length !== resolvedTestPaths.length) {
		console.error(`Length mismatch: ${testPaths.length} !== ${resolvedTestPaths.length}`)
		return false
	}

	let allCorrect = true
	for (const [i, resolvedTestPath] of resolvedTestPaths.entries()) {
		if (resolvedTestPath !== test) {
			allCorrect = false
			console.error(`Error resolving: ${testPaths[i]} --> ${resolvedTestPath}`)
		}
	}

	return allCorrect
}

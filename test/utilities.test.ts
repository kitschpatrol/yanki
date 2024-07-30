import { resolveLink } from '../src/lib/utilities/resolve-link'
import { css, html } from '../src/lib/utilities/string'
import {
	hostAndPortToUrl,
	isUrl,
	safeDecodeURI,
	safeDecodeURIComponent,
	urlToHostAndPort,
} from '../src/lib/utilities/url'
import { permute } from './utilities/permute'
import slash from 'slash'
import { expect, it } from 'vitest'

it('converts from url to host and port and back', () => {
	const hostAndPort = urlToHostAndPort('http://localhost:8765')
	if (hostAndPort === undefined) {
		throw new Error('hostAndPort should be defined')
	}

	const { host, port } = hostAndPort

	expect(host).toBe('http://localhost')
	expect(port).toBe(8765)

	const url = hostAndPortToUrl(host, port)
	expect(url).toBe('http://localhost:8765')
})

it('detects URLs correctly', () => {
	expect(isUrl('http://example.com')).toBeTruthy()
	expect(isUrl('https://example.com')).toBeTruthy()
	expect(
		isUrl(
			'obsidian://open?vault=test-obsidian-vault&file=%2FWiki%20Links%2FNested%2FNested%2Fast%20card.md%23Page%20links%23Bare',
		),
	).toBeTruthy()

	expect(isUrl('example.com')).toBeFalsy()
	expect(isUrl('/some/file.com')).toBeFalsy()
	expect(isUrl('/some/file.txt')).toBeFalsy()
	expect(isUrl('')).toBeFalsy()
	expect(isUrl('./some/file.txt')).toBeFalsy()
	expect(isUrl('../some/file.txt')).toBeFalsy()
	expect(isUrl('/some/file.txt')).toBeFalsy()
	expect(isUrl('./some/directory')).toBeFalsy()
	expect(isUrl('//some/directory')).toBeFalsy()

	// Windows paths
	expect(isUrl(String.raw`C:\Bla bla bla`)).toBeFalsy()
	expect(isUrl(String.raw`C:\\Bla bla bla`)).toBeFalsy()
	expect(isUrl(String.raw`C:\\Bla bla bla\\some file.txt`)).toBeFalsy()
	expect(isUrl(String.raw`d:\Bla bla bla`)).toBeFalsy()
	expect(isUrl(String.raw`z:\Bla bla bla`)).toBeFalsy()
	expect(isUrl(String.raw`\\?\Volume{abc123-abc123-abc123}\\`)).toBeFalsy()
	expect(isUrl(String.raw`\\Server\Share\folder`)).toBeFalsy()
	expect(isUrl(slash(String.raw`C:\Bla bla bla`))).toBeFalsy()
	expect(isUrl(slash(String.raw`C:\\Bla bla bla`))).toBeFalsy()
	expect(isUrl(slash(String.raw`C:\\Bla bla bla\\some file.txt`))).toBeFalsy()
	expect(isUrl(slash(String.raw`d:\Bla bla bla`))).toBeFalsy()
	expect(isUrl(slash(String.raw`z:\Bla bla bla`))).toBeFalsy()
	expect(isUrl(slash(String.raw`\\?\Volume{abc123-abc123-abc123}\\`))).toBeFalsy()
	expect(isUrl(slash(String.raw`\\Server\Share\folder`))).toBeFalsy()
})

it('treats URI decoding errors as undefined values', () => {
	expect(safeDecodeURI('https://example.com/Yes%20Please')).toMatch(
		'https://example.com/Yes Please',
	)
	expect(safeDecodeURI('https://example.com/Yes Please')).toMatch('https://example.com/Yes Please')
	expect(safeDecodeURI('https://example.com')).toMatch('https://example.com')
	expect(safeDecodeURIComponent('https://example.com/Yes%20Please')).toMatch(
		'https://example.com/Yes Please',
	)
	expect(safeDecodeURIComponent('https://example.com/Yes Please')).toMatch(
		'https://example.com/Yes Please',
	)
	expect(safeDecodeURIComponent('https://example.com')).toMatch('https://example.com')

	expect(safeDecodeURI('https://example.com/%E0%A4%A')).toBeUndefined()
	expect(safeDecodeURIComponent('https://example.com/%E0%A4%A')).toBeUndefined()
})

it('resolves a relative file path', () => {
	expect(
		resolveLink('./assets/test-obsidian-vault/test card.md', {
			cwd: '/base-path/cwd/',
		}),
	).toMatchInlineSnapshot(`"/base-path/cwd/assets/test-obsidian-vault/test card.md"`)
})

it('resolves a url-encoded relative file path', () => {
	expect(
		resolveLink('./assets/test-obsidian-vault/test%20card.md', {
			cwd: '/base-path/cwd/',
		}),
	).toMatchInlineSnapshot(`"/base-path/cwd/assets/test-obsidian-vault/test card.md"`)
})

it('resolves a relative file path with intermediate relative paths', () => {
	expect(
		resolveLink('./assets/test-obsidian-vault/../test-obsidian-vault/test card.md', {
			cwd: '/base-path/cwd/',
		}),
	).toMatchInlineSnapshot(`"/base-path/cwd/assets/test-obsidian-vault/test card.md"`)
})

it('resolves a relative file path without an extension', () => {
	// The allFilePaths option is hard-coded for the browser test, since globby
	// has Node dependencies
	expect(
		resolveLink('./test/assets/test-obsidian-vault/test card', {
			allFilePaths: ['/base-path/cwd/test/assets/test-obsidian-vault/test card.md'],
			cwd: '/base-path/cwd/',
			defaultExtension: 'md',
		}),
	).toMatchInlineSnapshot(`"/base-path/cwd/test/assets/test-obsidian-vault/test card.md"`)
})

it('resolves relative file paths', () => {
	// The allFilePaths option is hard-coded for the browser test, since globby
	// has Node dependencies
	const allFilePaths = [
		'/base-path/cwd/test/assets/test-obsidian-vault/test card.md',
		'/base-path/cwd/test/assets/test-obsidian-vault/Wiki Links/test card.md',
		'/base-path/cwd/test/assets/test-obsidian-vault/Cards/Group 1/test card.md',
		'/base-path/cwd/test/assets/test-obsidian-vault/Cards/Group 2/test card.md',
		'/base-path/cwd/test/assets/test-obsidian-vault/Wiki Links/Nested/test card.md',
		'/base-path/cwd/test/assets/test-obsidian-vault/Cards/Group 1/Sub Group/test card.md',
		'/base-path/cwd/test/assets/test-obsidian-vault/Wiki Links/Nested/Nested/test card.md',
	]

	// Node approach
	// const allRelativeFilePaths = await globby('./test/assets/test-obsidian-vault/**/*')
	// const allFilePaths = allRelativeFilePaths.map((filePath) =>
	// 	filePath.replace('./', '/base-path/cwd/'),
	// )

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
		resolveLink(testPath, {
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

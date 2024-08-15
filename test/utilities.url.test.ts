import { normalize } from '../src/lib/utilities/path'
import {
	hostAndPortToUrl,
	isUrl,
	safeDecodeURI,
	safeDecodeURIComponent,
	urlToHostAndPort,
} from '../src/lib/utilities/url'
import stripAnsi from 'strip-ansi'
import { expect, it, vi } from 'vitest'

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
	// Unsupported Windows paths will throw warnings
	const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()

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
	expect(isUrl('file:///c/bla bla bla.txt')).toBeTruthy()
	expect(isUrl('file://c/bla bla bla.txt')).toBeTruthy()

	// Windows paths
	expect(isUrl(String.raw`C:\Bla bla bla`)).toBeFalsy()
	expect(isUrl(String.raw`C:\\Bla bla bla`)).toBeFalsy()
	expect(isUrl(String.raw`C:\\Bla bla bla\\some file.txt`)).toBeFalsy()
	expect(isUrl(String.raw`d:\Bla bla bla`)).toBeFalsy()
	expect(isUrl(String.raw`z:\Bla bla bla`)).toBeFalsy()
	expect(isUrl(String.raw`z:/Bla bla bla`)).toBeFalsy()
	expect(isUrl(String.raw`/z:/Bla bla bla`)).toBeFalsy()
	expect(isUrl(String.raw`/z/Bla bla bla`)).toBeFalsy()
	expect(isUrl(String.raw`\\?\Volume{abc123-abc123-abc123}\\`)).toBeFalsy()
	expect(isUrl(String.raw`\\Server\Share\folder`)).toBeFalsy()
	expect(isUrl(normalize(String.raw`C:\Bla bla bla`))).toBeFalsy()
	expect(isUrl(normalize(String.raw`C:\\Bla bla bla`))).toBeFalsy()
	expect(isUrl(normalize(String.raw`C:\\Bla bla bla\\some file.txt`))).toBeFalsy()
	expect(isUrl(normalize(String.raw`d:\Bla bla bla`))).toBeFalsy()
	expect(isUrl(normalize(String.raw`z:\Bla bla bla`))).toBeFalsy()
	expect(isUrl(normalize(String.raw`\\?\Volume{abc123-abc123-abc123}\\`))).toBeFalsy() // This throws a warning
	expect(isUrl(normalize(String.raw`\\Server\Share\folder`))).toBeFalsy()

	expect(stripAnsi(String(spyWarn.mock.calls))).toMatchInlineSnapshot(
		`"Unsupported extended length path detected: \\\\?\\Volume{abc123-abc123-abc123}\\\\"`,
	)
	spyWarn.mockRestore()
})

it('treats URI decoding errors as undefined values', () => {
	const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()

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

	expect(stripAnsi(String(spyWarn.mock.calls))).toMatchInlineSnapshot(`"Error decoding URI text: "https://example.com/%E0%A4%A",URIError: URI malformed,Error decoding URI component text: "https://example.com/%E0%A4%A",URIError: URI malformed"`)
	spyWarn.mockRestore()
})

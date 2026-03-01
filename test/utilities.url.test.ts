/* eslint-disable node/no-unsupported-features/node-builtins */

import stripAnsi from 'strip-ansi'
import { expect, it, vi } from 'vitest'
import { normalize } from '../src/lib/utilities/path'
import {
	fileUrlToPath,
	getFileExtensionFromUrl,
	getSrcType,
	getUrlContentHash,
	hostAndPortToUrl,
	isUrl,
	safeDecodeURI,
	safeDecodeURIComponent,
	safeParseUrl,
	urlExists,
	urlToHostAndPort,
} from '../src/lib/utilities/url'

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

	expect(stripAnsi(String(spyWarn.mock.calls))).toMatchInlineSnapshot(
		`"Error decoding URI text: "https://example.com/%E0%A4%A",URIError: URI malformed,Error decoding URI component text: "https://example.com/%E0%A4%A",URIError: URI malformed"`,
	)
	spyWarn.mockRestore()
})

it('converts file URLs to paths', () => {
	expect(fileUrlToPath('file:///Users/me/file.txt')).toBe('/Users/me/file.txt')
	expect(fileUrlToPath('file:///c/documents/file.txt')).toBe('/c/documents/file.txt')
	// Non-file URLs are returned unchanged
	expect(fileUrlToPath('http://example.com')).toBe('http://example.com')
	// Non-URLs are returned unchanged
	expect(fileUrlToPath('/some/file.txt')).toBe('/some/file.txt')
})

it('safely parses URLs', () => {
	expect(safeParseUrl('http://example.com')).toBeDefined()
	expect(safeParseUrl('https://example.com/path')).toBeDefined()
	expect(safeParseUrl('not a url')).toBeUndefined()
	expect(safeParseUrl('')).toBeUndefined()
	expect(safeParseUrl('/just/a/path')).toBeUndefined()
})

it('classifies source types', () => {
	const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()

	expect(getSrcType('http://example.com/image.png')).toBe('remoteHttpUrl')
	expect(getSrcType('https://example.com/image.png')).toBe('remoteHttpUrl')
	expect(getSrcType('file:///Users/me/file.txt')).toBe('localFileUrl')
	expect(getSrcType('obsidian://open?vault=test&file=note')).toBe('obsidianVaultUrl')
	expect(getSrcType('/absolute/path/to/file.md')).toBe('localFilePath')
	expect(getSrcType('./relative/path/to/file.md')).toBe('localFilePath')
	expect(getSrcType('../relative/path/to/file.md')).toBe('localFilePath')
	expect(getSrcType('just-a-name')).toBe('localFileName')
	expect(getSrcType('note name')).toBe('localFileName')
	expect(getSrcType('ftp://example.com/file')).toBe('unsupportedProtocolUrl')

	spyWarn.mockRestore()
})

it('returns undefined for invalid host and port URLs', () => {
	expect(urlToHostAndPort('not a url')).toBeUndefined()
	expect(urlToHostAndPort('')).toBeUndefined()
})

it('checks if URLs exist', async () => {
	const successFetch = vi.fn().mockResolvedValue({ status: 200 })
	expect(await urlExists('http://example.com', successFetch)).toBe(true)

	const notFoundFetch = vi.fn().mockResolvedValue({ status: 404 })
	expect(await urlExists('http://example.com', notFoundFetch)).toBe(false)

	const failFetch = vi.fn().mockRejectedValue(new Error('network error'))
	expect(await urlExists('http://example.com', failFetch)).toBe(false)
})

it('gets file extension from URL via name mode', async () => {
	const result = await getFileExtensionFromUrl('http://example.com/image.png', undefined, 'name')
	expect(result).toBe('png')
})

it('gets file extension from URL path for supported types', async () => {
	expect(await getFileExtensionFromUrl('http://example.com/audio.mp3', undefined, 'name')).toBe(
		'mp3',
	)
	expect(await getFileExtensionFromUrl('http://example.com/video.mp4', undefined, 'name')).toBe(
		'mp4',
	)
	expect(await getFileExtensionFromUrl('http://example.com/doc.pdf', undefined, 'name')).toBe('pdf')
})

it('returns undefined for unsupported URL extensions', async () => {
	expect(
		await getFileExtensionFromUrl('http://example.com/file.xyz', undefined, 'name'),
	).toBeUndefined()
})

it('gets file extension from URL via metadata mode with content-type', async () => {
	const fetchAdapter = vi.fn().mockResolvedValue({
		headers: new Headers({ 'content-type': 'image/png' }),
		status: 200,
	})

	const result = await getFileExtensionFromUrl('http://example.com/image', fetchAdapter, 'metadata')
	expect(result).toBe('png')
})

it('falls through from metadata to name mode when fetch fails', async () => {
	const fetchAdapter = vi.fn().mockRejectedValue(new Error('network error'))

	const result = await getFileExtensionFromUrl(
		'http://example.com/image.jpg',
		fetchAdapter,
		'metadata',
	)
	expect(result).toBe('jpg')
})

it('falls through from metadata to name mode when no fetchAdapter', async () => {
	const result = await getFileExtensionFromUrl(
		'http://example.com/image.jpg',
		undefined,
		'metadata',
	)
	expect(result).toBe('jpg')
})

it('falls through from metadata to name mode when no content-type header', async () => {
	const fetchAdapter = vi.fn().mockResolvedValue({
		headers: new Headers(),
		status: 200,
	})

	const result = await getFileExtensionFromUrl(
		'http://example.com/image.gif',
		fetchAdapter,
		'metadata',
	)
	expect(result).toBe('gif')
})

it('gets URL content hash in name mode', async () => {
	const fetchAdapter = vi.fn()
	const hash = await getUrlContentHash('http://example.com/file.png', fetchAdapter, 'name')
	expect(hash).toHaveLength(16)
	expect(typeof hash).toBe('string')
})

it('gets URL content hash in metadata mode', async () => {
	const fetchAdapter = vi.fn().mockResolvedValue({
		headers: new Headers({
			'content-length': '12345',
			etag: '"abc123"',
			'last-modified': 'Wed, 01 Jan 2025 00:00:00 GMT',
		}),
	})

	const hash = await getUrlContentHash('http://example.com/file.png', fetchAdapter, 'metadata')
	expect(hash).toHaveLength(16)
})

it('falls through from metadata to name mode for URL content hash when headers missing', async () => {
	const fetchAdapter = vi.fn().mockResolvedValue({
		headers: new Headers(),
	})

	const hash = await getUrlContentHash('http://example.com/file.png', fetchAdapter, 'metadata')
	expect(hash).toHaveLength(16)
})

it('falls through from content to metadata mode for URL content hash', async () => {
	const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()
	const fetchAdapter = vi.fn().mockResolvedValue({
		headers: new Headers({ etag: '"abc"' }),
	})

	const hash = await getUrlContentHash('http://example.com/file.png', fetchAdapter, 'content')
	expect(hash).toHaveLength(16)
	expect(spyWarn).toHaveBeenCalled()
	spyWarn.mockRestore()
})

it('produces consistent hashes for the same URL', async () => {
	const fetchAdapter = vi.fn()
	const hash1 = await getUrlContentHash('http://example.com/file.png', fetchAdapter, 'name')
	const hash2 = await getUrlContentHash('http://example.com/file.png', fetchAdapter, 'name')
	expect(hash1).toBe(hash2)
})

it('produces different hashes for different URLs', async () => {
	const fetchAdapter = vi.fn()
	const hash1 = await getUrlContentHash('http://example.com/file1.png', fetchAdapter, 'name')
	const hash2 = await getUrlContentHash('http://example.com/file2.png', fetchAdapter, 'name')
	expect(hash1).not.toBe(hash2)
})

it('gets URL content hash with Record-style headers', async () => {
	const fetchAdapter = vi.fn().mockResolvedValue({
		headers: {
			'Content-Length': '12345',
			ETag: '"abc123"',
			'Last-Modified': 'Wed, 01 Jan 2025 00:00:00 GMT',
		},
	})

	const hash = await getUrlContentHash('http://example.com/file.png', fetchAdapter, 'metadata')
	expect(hash).toHaveLength(16)
})

it('gets file extension from URL via metadata with Record-style headers', async () => {
	const fetchAdapter = vi.fn().mockResolvedValue({
		headers: { 'Content-Type': 'image/jpeg' },
		status: 200,
	})

	const result = await getFileExtensionFromUrl('http://example.com/image', fetchAdapter, 'metadata')
	expect(result).toBe('jpg')
})

it('warns and returns undefined for un-parsable URL in name mode', async () => {
	const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()

	const result = await getFileExtensionFromUrl('not-a-url', undefined, 'name')
	expect(result).toBeUndefined()
	expect(spyWarn).toHaveBeenCalledWith(expect.stringContaining('Could not parse URL'))
	spyWarn.mockRestore()
})

it('gets extension from URL query string when no extension in path', async () => {
	const result = await getFileExtensionFromUrl(
		'http://example.com/media?file=audio.mp3',
		undefined,
		'name',
	)
	expect(result).toBe('mp3')
})

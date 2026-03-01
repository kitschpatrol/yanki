/* eslint-disable node/no-unsupported-features/node-builtins, unicorn/no-useless-undefined */
import { expect, it, vi } from 'vitest'
import type { FileAdapter } from '../src/lib/shared/types'
import {
	getAnkiMediaFilenameExtension,
	getSafeAnkiMediaFilename,
	mediaAssetExists,
} from '../src/lib/utilities/media'

function createMockFileAdapter(overrides: Partial<FileAdapter> = {}): FileAdapter {
	/* eslint-disable ts/require-await, ts/no-empty-function */
	return {
		async readFile() {
			return 'file content'
		},
		async readFileBuffer() {
			return new Uint8Array([1, 2, 3])
		},
		async rename() {},
		async stat() {
			return { ctimeMs: 1_000_000, mtimeMs: 2_000_000, size: 1024 }
		},
		async writeFile() {},
		...overrides,
	}
	/* eslint-enable ts/require-await, ts/no-empty-function */
}

it('gets supported image extension from file path', async () => {
	expect(await getAnkiMediaFilenameExtension('/path/to/image.png', undefined)).toBe('png')
	expect(await getAnkiMediaFilenameExtension('/path/to/image.jpg', undefined)).toBe('jpg')
	expect(await getAnkiMediaFilenameExtension('/path/to/image.gif', undefined)).toBe('gif')
	expect(await getAnkiMediaFilenameExtension('/path/to/image.webp', undefined)).toBe('webp')
	expect(await getAnkiMediaFilenameExtension('/path/to/image.svg', undefined)).toBe('svg')
})

it('gets supported audio extension from file path', async () => {
	expect(await getAnkiMediaFilenameExtension('/path/to/audio.mp3', undefined)).toBe('mp3')
	expect(await getAnkiMediaFilenameExtension('/path/to/audio.wav', undefined)).toBe('wav')
	expect(await getAnkiMediaFilenameExtension('/path/to/audio.ogg', undefined)).toBe('ogg')
	expect(await getAnkiMediaFilenameExtension('/path/to/audio.flac', undefined)).toBe('flac')
})

it('gets supported video extension from file path', async () => {
	expect(await getAnkiMediaFilenameExtension('/path/to/video.mp4', undefined)).toBe('mp4')
	expect(await getAnkiMediaFilenameExtension('/path/to/video.webm', undefined)).toBe('webm')
	expect(await getAnkiMediaFilenameExtension('/path/to/video.mov', undefined)).toBe('mov')
})

it('gets supported file extensions from file path', async () => {
	expect(await getAnkiMediaFilenameExtension('/path/to/document.pdf', undefined)).toBe('pdf')
	expect(await getAnkiMediaFilenameExtension('/path/to/note.md', undefined)).toBe('md')
})

it('returns undefined for unsupported extensions', async () => {
	expect(await getAnkiMediaFilenameExtension('/path/to/file.xyz', undefined)).toBeUndefined()
	expect(await getAnkiMediaFilenameExtension('/path/to/file.txt', undefined)).toBeUndefined()
	expect(await getAnkiMediaFilenameExtension('/path/to/file.doc', undefined)).toBeUndefined()
})

it('returns undefined for files without extensions', async () => {
	expect(await getAnkiMediaFilenameExtension('/path/to/file', undefined)).toBeUndefined()
})

it('gets extension from URL via metadata', async () => {
	const fetchAdapter = vi.fn().mockResolvedValue({
		headers: new Headers({ 'content-type': 'image/jpeg' }),
		status: 200,
	})

	const result = await getAnkiMediaFilenameExtension('http://example.com/image', fetchAdapter)
	expect(result).toBe('jpg')
})

it('checks if local file exists', async () => {
	const fileAdapter = createMockFileAdapter()
	const fetchAdapter = vi.fn()

	expect(await mediaAssetExists('/path/to/file.png', fileAdapter, fetchAdapter)).toBe(true)
})

it('checks if local file does not exist', async () => {
	const fileAdapter = createMockFileAdapter({
		// eslint-disable-next-line ts/require-await
		async stat() {
			throw new Error('ENOENT')
		},
	})
	const fetchAdapter = vi.fn()

	expect(await mediaAssetExists('/path/to/missing.png', fileAdapter, fetchAdapter)).toBe(false)
})

it('checks if remote URL exists', async () => {
	const fileAdapter = createMockFileAdapter()
	const fetchAdapter = vi.fn().mockResolvedValue({ status: 200 })

	expect(await mediaAssetExists('http://example.com/image.png', fileAdapter, fetchAdapter)).toBe(
		true,
	)
})

it('checks if remote URL does not exist', async () => {
	const fileAdapter = createMockFileAdapter()
	const fetchAdapter = vi.fn().mockResolvedValue({ status: 404 })

	expect(await mediaAssetExists('http://example.com/missing.png', fileAdapter, fetchAdapter)).toBe(
		false,
	)
})

it('returns undefined for non-existent file in getSafeAnkiMediaFilename', async () => {
	const fileAdapter = createMockFileAdapter({
		// eslint-disable-next-line ts/require-await
		async stat() {
			throw new Error('ENOENT')
		},
	})
	const fetchAdapter = vi.fn()

	const result = await getSafeAnkiMediaFilename(
		'/path/to/missing.png',
		'test-namespace',
		'png',
		fileAdapter,
		fetchAdapter,
	)
	expect(result).toBeUndefined()
})

it('generates a safe filename for an existing file', async () => {
	const fileAdapter = createMockFileAdapter()
	const fetchAdapter = vi.fn()

	const result = await getSafeAnkiMediaFilename(
		'/path/to/image.png',
		'test-namespace',
		'png',
		fileAdapter,
		fetchAdapter,
	)
	expect(result).toBeDefined()
	expect(result).toContain('yanki-')
	expect(result!.endsWith('.png')).toBe(true)
	expect(result!.length).toBeLessThanOrEqual(120)
})

it('generates a safe filename without extension', async () => {
	const fileAdapter = createMockFileAdapter()
	const fetchAdapter = vi.fn()

	const result = await getSafeAnkiMediaFilename(
		'/path/to/file',
		'test-namespace',
		undefined,
		fileAdapter,
		fetchAdapter,
	)
	expect(result).toBeDefined()
	expect(result).toContain('yanki-')
	expect(result!.includes('.')).toBe(false)
})

it('generates consistent filenames for the same file', async () => {
	const fileAdapter = createMockFileAdapter()
	const fetchAdapter = vi.fn()

	const result1 = await getSafeAnkiMediaFilename(
		'/path/to/image.png',
		'test-namespace',
		'png',
		fileAdapter,
		fetchAdapter,
	)
	const result2 = await getSafeAnkiMediaFilename(
		'/path/to/image.png',
		'test-namespace',
		'png',
		fileAdapter,
		fetchAdapter,
	)
	expect(result1).toBe(result2)
})

it('generates different filenames for different namespaces', async () => {
	const fileAdapter = createMockFileAdapter()
	const fetchAdapter = vi.fn()

	const result1 = await getSafeAnkiMediaFilename(
		'/path/to/image.png',
		'namespace-a',
		'png',
		fileAdapter,
		fetchAdapter,
	)
	const result2 = await getSafeAnkiMediaFilename(
		'/path/to/image.png',
		'namespace-b',
		'png',
		fileAdapter,
		fetchAdapter,
	)
	expect(result1).not.toBe(result2)
})

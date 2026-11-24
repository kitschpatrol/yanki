import { uint8ArrayToBase64 } from 'uint8array-extras'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fileContentToBase64 } from '../src/lib/utilities/file'

type NativeBase64 = { toBase64?: () => string }

const nativeBase64Prototype = Uint8Array.prototype as NativeBase64 & Uint8Array
const nativeToBase64 = nativeBase64Prototype.toBase64

/** Byte arrays of every length around the padding boundaries, plus a long one. */
const samples = [0, 1, 2, 3, 4, 5, 6, 255, 256, 257, 100_000].map((length) =>
	Uint8Array.from({ length }, (_, index) => (index * 31 + length) % 256),
)

function expectCorrectEncoding(encode: (fileContent: Uint8Array) => string): void {
	expect(encode(new Uint8Array([104, 105]))).toBe('aGk=')
	expect(encode(new Uint8Array([251, 255, 254]))).toBe('+//+')
	expect(encode(new Uint8Array())).toBe('')

	// Only the bytes a view covers, not the whole buffer behind it
	expect(encode(new Uint8Array(new Uint8Array([0, 104, 105, 0]).buffer, 1, 2))).toBe('aGk=')

	for (const sample of samples) {
		expect(encode(sample)).toBe(uint8ArrayToBase64(sample))
	}
}

describe('fileContentToBase64', () => {
	afterEach(() => {
		vi.restoreAllMocks()
		vi.doUnmock('../src/lib/utilities/platform')
		vi.resetModules()

		if (nativeToBase64 === undefined) {
			delete nativeBase64Prototype.toBase64
		} else {
			nativeBase64Prototype.toBase64 = nativeToBase64
		}
	})

	it('encodes standard, padded base64 on this runtime', () => {
		expect(fileContentToBase64(new Uint8Array([104, 105]))).toBe('aGk=')
		expectCorrectEncoding(fileContentToBase64)
	})

	it('uses the native base64 method when the runtime has one', () => {
		nativeBase64Prototype.toBase64 = () => 'from the native method'

		expect(fileContentToBase64(new Uint8Array([1, 2, 3]))).toBe('from the native method')
	})

	it('encodes through Buffer on a Node without the native method', () => {
		delete nativeBase64Prototype.toBase64
		const spyBufferFrom = vi.spyOn(Buffer, 'from')

		expect(fileContentToBase64(new Uint8Array([104, 105]))).toBe('aGk=')
		expect(spyBufferFrom).toHaveBeenCalledTimes(1)

		spyBufferFrom.mockRestore()
		expectCorrectEncoding(fileContentToBase64)
	})

	it('encodes in JavaScript outside Node without the native method', async () => {
		delete nativeBase64Prototype.toBase64
		vi.resetModules()
		vi.doMock('../src/lib/utilities/platform', () => ({
			ENVIRONMENT: 'browser',
			PLATFORM: 'other',
		}))
		const { fileContentToBase64: browserFileContentToBase64 } =
			await import('../src/lib/utilities/file')
		const spyBufferFrom = vi.spyOn(Buffer, 'from')

		expect(browserFileContentToBase64(new Uint8Array([104, 105]))).toBe('aGk=')
		expect(spyBufferFrom).not.toHaveBeenCalled()

		spyBufferFrom.mockRestore()
		expectCorrectEncoding(browserFileContentToBase64)
	})
})

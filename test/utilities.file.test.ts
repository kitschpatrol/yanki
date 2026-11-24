import { uint8ArrayToBase64 } from 'uint8array-extras'
import { afterEach, describe, expect, it } from 'vitest'
import { fileContentToBase64 } from '../src/lib/utilities/file'

type NativeBase64 = { toBase64?: () => string }

const nativeBase64Prototype = Uint8Array.prototype as NativeBase64 & Uint8Array
const nativeToBase64 = nativeBase64Prototype.toBase64

/** Byte arrays of every length around the padding boundaries, plus a long one. */
const samples = [0, 1, 2, 3, 4, 5, 6, 255, 256, 257, 100_000].map((length) =>
	Uint8Array.from({ length }, (_, index) => (index * 31 + length) % 256),
)

describe('fileContentToBase64', () => {
	afterEach(() => {
		if (nativeToBase64 === undefined) {
			delete nativeBase64Prototype.toBase64
		} else {
			nativeBase64Prototype.toBase64 = nativeToBase64
		}
	})

	it('encodes the standard, padded base64 of the content', () => {
		expect(fileContentToBase64(new Uint8Array([104, 105]))).toBe('aGk=')
		expect(fileContentToBase64(new Uint8Array([251, 255, 254]))).toBe('+//+')
		expect(fileContentToBase64(new Uint8Array())).toBe('')
	})

	it('matches the JavaScript implementation for content of every length', () => {
		for (const sample of samples) {
			expect(fileContentToBase64(sample)).toBe(uint8ArrayToBase64(sample))
		}
	})

	it('encodes the same without a native base64 method', () => {
		delete nativeBase64Prototype.toBase64

		expect(fileContentToBase64(new Uint8Array([251, 255, 254]))).toBe('+//+')
		for (const sample of samples) {
			expect(fileContentToBase64(sample)).toBe(uint8ArrayToBase64(sample))
		}
	})

	it('uses the native base64 method when the runtime has one', () => {
		nativeBase64Prototype.toBase64 = () => 'from the native method'

		expect(fileContentToBase64(new Uint8Array([1, 2, 3]))).toBe('from the native method')
	})

	it('encodes only the bytes a view covers', () => {
		const view = new Uint8Array(new Uint8Array([0, 104, 105, 0]).buffer, 1, 2)
		expect(fileContentToBase64(view)).toBe('aGk=')
	})
})

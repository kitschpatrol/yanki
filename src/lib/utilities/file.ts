/* eslint-disable jsdoc/require-jsdoc */

import { uint8ArrayToBase64 } from 'uint8array-extras'
import type { FileAdapter } from '../shared/types'
import { MEDIA_DEFAULT_HASH_MODE_FILE } from '../shared/constants'
import { ENVIRONMENT } from './platform'
import { getHash } from './string'

export async function fileExists(
	absoluteFilePath: string,
	fileAdapter: FileAdapter,
): Promise<boolean> {
	try {
		await fileAdapter.stat(absoluteFilePath)
		return true
	} catch {
		return false
	}
}

/**
 * Base64-encode the content of a file, by the fastest means the runtime has.
 * This matters when a sync uploads a lot of media: the JavaScript
 * implementation is 20 to 50 times slower than either native one. All three
 * produce the same standard, padded encoding.
 */
export function fileContentToBase64(fileContent: Uint8Array): string {
	if (hasNativeBase64(fileContent)) {
		return fileContent.toBase64()
	}

	// Node 22 and 24 have no base64 method on typed arrays, but encode natively
	// through Buffer. The Buffer shares the content's memory instead of copying it.
	if (ENVIRONMENT === 'node') {
		return Buffer.from(fileContent.buffer, fileContent.byteOffset, fileContent.byteLength).toString(
			'base64',
		)
	}

	return uint8ArrayToBase64(fileContent)
}

/**
 * Whether a typed array has the native base64 method, which is too recent to be
 * in the TypeScript library types this project builds against.
 */
function hasNativeBase64(
	fileContent: Uint8Array,
): fileContent is Uint8Array & { toBase64: () => string } {
	return 'toBase64' in fileContent && typeof fileContent.toBase64 === 'function'
}

export async function getFileContentHash(
	absoluteFilePath: string,
	fileAdapter: FileAdapter,
	mode = MEDIA_DEFAULT_HASH_MODE_FILE,
): Promise<string> {
	switch (mode) {
		case 'content': {
			const fileContent = await fileAdapter.readFileBuffer(absoluteFilePath)
			// Sha1 would technically be fine but is not measurably more performant...
			// Copy since Web Crypto rejects views over a SharedArrayBuffer
			// eslint-disable-next-line node/no-unsupported-features/node-builtins -- Global Web Crypto is unflagged and warning-free since Node 19, it was only relabeled stable in 23
			const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(fileContent))
			const shaHash = Array.from(new Uint8Array(digest), (byte) =>
				byte.toString(16).padStart(2, '0'),
			).join('')
			return shaHash.slice(0, 16)
		}

		case 'metadata': {
			// Skipping ctimeMs, as it's not stable across systems
			// Consumer-provided file adapters may return null fields, which destructuring defaults would not replace
			const { mtimeMs, size } = await fileAdapter.stat(absoluteFilePath)

			// Ctime not stable?
			// eslint-disable-next-line ts/no-unnecessary-condition
			const metadataString = `${mtimeMs ?? ''}${size ?? ''}`

			// Fall through to name mode if metadata is missing, otherwise include
			// the path so distinct files that happen to share size and mtime (e.g.
			// batch-copied within the same millisecond) don't collide
			return getHash(
				metadataString === '' ? absoluteFilePath : `${absoluteFilePath}${metadataString}`,
				16,
			)
		}

		case 'name': {
			return getHash(absoluteFilePath, 16)
		}
	}
}

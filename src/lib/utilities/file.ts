/* eslint-disable jsdoc/require-jsdoc */

import type { FileAdapter } from '../shared/types'
import { MEDIA_DEFAULT_HASH_MODE_FILE } from '../shared/constants'
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
			// eslint-disable-next-line unicorn/prefer-default-parameters
			const { mtimeMs, size } = await fileAdapter.stat(absoluteFilePath)

			// Ctime not stable?
			// eslint-disable-next-line ts/no-unnecessary-condition
			const metadataString = `${mtimeMs ?? ''}${size ?? ''}`

			if (metadataString === '') {
				// Fall through to name mode
				return getHash(absoluteFilePath, 16)
			}

			// Include the path so distinct files that happen to share size and
			// mtime (e.g. batch-copied within the same millisecond) don't collide
			return getHash(`${absoluteFilePath}${metadataString}`, 16)
		}

		case 'name': {
			return getHash(absoluteFilePath, 16)
		}
	}
}

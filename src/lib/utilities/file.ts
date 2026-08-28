/* eslint-disable jsdoc/require-jsdoc */

import { sha256 } from 'crypto-hash'
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
			const shaHash = await sha256(fileContent)
			return shaHash.slice(0, 16)
		}

		case 'metadata': {
			// Skipping ctimeMs, as it's not stable across systems
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

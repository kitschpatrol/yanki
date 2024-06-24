import { MEDIA_DEFAULT_HASH_MODE_FILE } from '../shared/constants'
import type { FileAdapters } from '../shared/types'
import { getHash } from './string'
import { sha256 } from 'crypto-hash'

export async function getFileContentHash(
	absoluteFilePath: string,
	fileAdapters: FileAdapters,
	mode = MEDIA_DEFAULT_HASH_MODE_FILE,
): Promise<string> {
	switch (mode) {
		case 'content': {
			const fileContent = await fileAdapters.readFileBuffer(absoluteFilePath)
			// Sha1 would technically be fine but is not measurably more performant...
			const shaHash = await sha256(fileContent)
			return shaHash.slice(0, 16)
		}

		case 'metadata': {
			// Skipping ctimeMs, as it's not stable across systems
			const { mtimeMs, size } = await fileAdapters.stat(absoluteFilePath)

			// Ctime not stable?
			const stringToHash = `${mtimeMs ?? ''}${size ?? ''}`

			if (stringToHash === '') {
				// Fall through to name mode
				return getFileContentHash(absoluteFilePath, fileAdapters, 'name')
			}

			return getHash(stringToHash, 16)
		}

		case 'name': {
			return getHash(absoluteFilePath, 16)
		}
	}
}

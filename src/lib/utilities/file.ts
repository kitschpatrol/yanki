import { MEDIA_HASH_MODE } from '../shared/constants'
import type { FileAdapters } from '../shared/types'
import { getHash } from './string'

export async function getFileContentHash(
	absoluteFilePath: string,
	fileAdapters: FileAdapters,
	mode = MEDIA_HASH_MODE,
): Promise<string> {
	// Obliging the no-fallthrough lint rule, but this effectively falls through
	// via recursion instead...
	switch (mode) {
		case 'content': {
			// TODO do a real hash of the actual content?
			// Try more performance metadata approach first?
			// Use crypto-hash thing for performant isomorphic hashing? How slow?
			console.warn('`content` hash mode is not yet implemented for URLs')
			// Fall through to metadata mode
			return getFileContentHash(absoluteFilePath, fileAdapters, 'metadata')
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

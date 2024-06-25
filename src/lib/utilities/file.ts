import { MEDIA_DEFAULT_HASH_MODE_FILE } from '../shared/constants'
import type { FileAdapter } from '../shared/types'
import { getHash } from './string'
import { sha256 } from 'crypto-hash'
import path from 'path-browserify-esm'

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
			const stringToHash = `${mtimeMs ?? ''}${size ?? ''}`

			if (stringToHash === '') {
				// Fall through to name mode
				return getFileContentHash(absoluteFilePath, fileAdapter, 'name')
			}

			return getHash(stringToHash, 16)
		}

		case 'name': {
			return getHash(absoluteFilePath, 16)
		}
	}
}

/**
 * Obsidian treats absolute links, and certain relative links, as relative to
 * the vault root.
 *
 * When a `basePath` (likely the vault root) is provided and `obsidianMode` is
 * true:
 *
 *  `Assets/image.png'`--> `/Vault/Assets/image.png`
 *  `/Assets/image.png` --> `/Vault/Assets/image.png`
 * 	`../Something/Else.png` --> `/Vault/CWD/../Something/Else.png`
 * 	`./Something/Else.png` --> `/Vault/CWD/Something/Else.png`
 *
 * @param filePath
 * @param options
 * @returns
 */
export function resolveWithBasePath(
	filePath: string,
	options: { basePath?: string; cwd?: string; obsidianMode?: boolean },
): string {
	const { basePath, cwd, obsidianMode = true } = options

	const includeCwd = !(obsidianMode && basePath !== undefined && !filePath.startsWith('.'))
	const resolvedPath = path.join(basePath ?? '', includeCwd ? cwd ?? '' : '', filePath)
	return path.normalize(resolvedPath)
}

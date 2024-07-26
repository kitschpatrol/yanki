import { MEDIA_DEFAULT_HASH_MODE_FILE } from '../shared/constants'
import type { FileAdapter } from '../shared/types'
import { getHash, splitAtFirstMatch } from './string'
import { sha256 } from 'crypto-hash'
import path from 'path-browserify-esm'

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
 * the vault root, but we do this as a "last resort" if named link resolution fails.
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

	const newBase = path.normalize(
		path.join(includeCwd ? '' : (basePath ?? ''), includeCwd ? (cwd ?? '') : ''),
	)

	// Idempotence
	if (filePath.startsWith(newBase)) {
		return path.normalize(filePath)
	}

	return path.normalize(path.join(newBase, filePath))
}

/**
 *
 * @param filePath
 * @param cwd Absolute path
 * @returns
 */
export function resolveWithCwd(filePath: string, cwd: string): string {
	if (filePath.startsWith('cwd')) {
		return path.normalize(filePath)
	}

	return path.normalize(path.join(cwd, filePath))
}

export function stripBasePath(filePath: string, basePath: string): string {
	const regex = new RegExp(`^${basePath}`)
	return filePath.replace(regex, '')
}

export function getBaseAndQueryParts(filePath: string): [string, string | undefined] {
	return splitAtFirstMatch(filePath, /[#?^]/)
}

import { getHash, getNamespaceHash } from './string'
import slugify from '@sindresorhus/slugify'
import path from 'path-browserify-esm'

/**
 * @param pathOrUrl
 * @returns Extension without the `.`, possibly an extra string if no extension is found
 */
export function getAnkiMediaFilenameExtension(pathOrUrl: string): string | undefined {
	try {
		const url = new URL(pathOrUrl)
		const pathnameParts = url.pathname.split('.')
		if (pathnameParts.length > 1) {
			return pathnameParts.at(-1)
		}

		// Look in the query string if we must...
		const searchParts = url.search.split('.')
		if (searchParts.length > 1) {
			return searchParts.at(-1)
		}

		// Nothing extension-like found
		return undefined
	} catch {
		// Must be a file path
		const filePath = pathOrUrl
		const extension = path.extname(filePath).slice(1)
		if (extension.length > 0) {
			return extension
		}

		// No extension found
		return undefined
	}
}

function getLegibleFilename(pathOrUrl: string, maxLength: number): string {
	let legibleFilename: string | undefined

	try {
		const url = new URL(pathOrUrl)
		legibleFilename = url.pathname
	} catch {
		// Must be a file path
		const filePath = pathOrUrl
		legibleFilename = path.basename(filePath, path.extname(filePath))
	}

	// Should never happen
	if (legibleFilename === undefined) {
		throw new Error(`Could not create a legible file name for: ${pathOrUrl}`)
	}

	return slugify(legibleFilename.trim()).slice(0, maxLength).replace(/-+$/, '')
}

export function getSafeAnkiMediaFilename(absolutePathOrUrl: string, namespace: string): string {
	const namespaceHash = getNamespaceHash(namespace)
	const assetPathHash = getHash(absolutePathOrUrl, 8)
	const fileExtension = getAnkiMediaFilenameExtension(absolutePathOrUrl)
	const legibleFilename = getLegibleFilename(absolutePathOrUrl, 60)

	const safeFilename = `${namespaceHash}-${assetPathHash}-${legibleFilename}.${fileExtension}`

	// Should never happen
	// Anki truncates long file names... so we crush the complete path down to a hash
	// Observed max length in Anki seems to be 115... we leave some breathing room
	if (safeFilename.length > 100) {
		throw new Error(`Filename too long: ${safeFilename}`)
	}

	return safeFilename
}

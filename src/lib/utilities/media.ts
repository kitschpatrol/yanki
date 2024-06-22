import { yankiMaxMediaFilenameLength } from '../model/constants'
import { yankiSupportedAudioVideoFormats, yankiSupportedImageFormats } from '../model/model'
import { getSlugifiedNamespace } from './namespace'
import { getHash, truncateOnWordBoundary } from './string'
import slugify from '@sindresorhus/slugify'
import path from 'path-browserify-esm'

/**
 * @param pathOrUrl
 * @returns Extension without the `.`, possibly an extra string if no extension is found
 */
export function getAnkiMediaFilenameExtension(
	pathOrUrl: string,
	allowUnknownUrlExtension: boolean,
): string | undefined {
	let extensionCandidate: string | undefined
	let isUrl = false

	try {
		const url = new URL(pathOrUrl)
		isUrl = true
		const pathnameParts = url.pathname.split('.')
		if (pathnameParts.length > 1) {
			extensionCandidate = pathnameParts.at(-1)
		} else {
			// Look in the query string if we must...
			const searchParts = url.search.split('.')
			extensionCandidate = searchParts.at(-1)
		}
	} catch {
		// Must be a file path
		const filePath = pathOrUrl
		extensionCandidate = path.extname(filePath).slice(1)
	}

	// Make sure it's supported

	if (
		extensionCandidate === undefined ||
		!([...yankiSupportedAudioVideoFormats, ...yankiSupportedImageFormats] as string[]).includes(
			extensionCandidate,
		)
	) {
		if (isUrl && allowUnknownUrlExtension) {
			return 'unknown'
		}

		return undefined
	}

	return extensionCandidate
}

function getLegibleFilename(pathOrUrl: string, maxLength: number): string {
	let legibleFilename: string | undefined

	try {
		const url = new URL(pathOrUrl)
		// Also remove extension from URL if it's there, but it won't always be
		legibleFilename = path.basename(url.pathname, path.extname(url.pathname))
	} catch {
		// Must be a file path
		const filePath = pathOrUrl
		legibleFilename = path.basename(filePath, path.extname(filePath))
	}

	// Should never happen
	if (legibleFilename === undefined) {
		throw new Error(`Could not create a legible file name for: ${pathOrUrl}`)
	}

	// Slugify without double-dashes, temporarily convert to spaces for truncation on word boundaries
	const fullSpacedSlug = slugify(legibleFilename.trim()).replaceAll(/-+/g, ' ')

	return truncateOnWordBoundary(fullSpacedSlug, maxLength).replaceAll(' ', '-')
}

// Anki truncates long file names... so we crush the complete path down to a hash

export function getSafeAnkiMediaFilename(
	absolutePathOrUrl: string,
	namespace: string,
	allowUnknownUrlExtension: boolean,
): string {
	// Can be a bit more than 40 characters, since it's always prefixed with `yanki-media-`
	const safeNamespace = getSlugifiedNamespace(namespace)

	// TODO actually hash the content... pass in Fetch and File adapters? Use
	// crypto-hash thing for performant isomorphic hashing? How slow?
	// Or fstat for files and headers for URLs would be faster?
	const assetPathHash = getHash(absolutePathOrUrl, 16)

	const rawFileExtension = getAnkiMediaFilenameExtension(
		absolutePathOrUrl,
		allowUnknownUrlExtension,
	)
	const fileExtension = rawFileExtension === undefined ? '' : `.${rawFileExtension}`

	// Make the legible filename as long as possible, add in the dash widths, dot is included in the extension
	const legibleFilenameLength =
		yankiMaxMediaFilenameLength -
		(safeNamespace.length + 1 + assetPathHash.length + 1 + fileExtension.length)

	const legibleFilename = getLegibleFilename(absolutePathOrUrl, legibleFilenameLength)
	// 40 + 1 + 16 + 1 + ? + 1 + 8
	const safeFilename = `${safeNamespace}-${assetPathHash}-${legibleFilename}${fileExtension}`

	// Should never happen
	if (safeFilename.length > yankiMaxMediaFilenameLength) {
		throw new Error(`Filename too long: ${safeFilename}`)
	}

	return safeFilename
}

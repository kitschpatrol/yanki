import {
	MEDIA_FILENAME_MAX_LENGTH,
	MEDIA_INCLUDE_LEGIBLE_FILENAME,
	MEDIA_SUPPORTED_AUDIO_VIDEO_EXTENSIONS,
	MEDIA_SUPPORTED_IMAGE_EXTENSIONS,
} from '../shared/constants'
import { type FetchAdapter, type FileAdapter } from '../shared/types'
import { fileExists, getFileContentHash } from './file'
import { getSlugifiedNamespace } from './namespace'
import { truncateOnWordBoundary } from './string'
import { getFileExtensionFromUrl, getUrlContentHash, isUrl, urlExists } from './url'
import slugify from '@sindresorhus/slugify'
import path from 'path-browserify-esm'

/**
 * @param pathOrUrl
 * @returns Extension without the `.`, possibly an extra string if no extension is found
 * TODO check for how it handles query strings
 */
export async function getAnkiMediaFilenameExtension(
	pathOrUrl: string,
	fetchAdapter: FetchAdapter | undefined,
): Promise<string | undefined> {
	const extensionCandidate = isUrl(pathOrUrl)
		? await getFileExtensionFromUrl(pathOrUrl, fetchAdapter)
		: path.posix.extname(pathOrUrl).slice(1)

	// Make sure it's supported, note 'unknown' special case for URLs
	if (
		extensionCandidate === undefined ||
		!(
			[
				'unknown',
				...MEDIA_SUPPORTED_AUDIO_VIDEO_EXTENSIONS,
				...MEDIA_SUPPORTED_IMAGE_EXTENSIONS,
			] as string[]
		).includes(extensionCandidate)
	) {
		return undefined
	}

	return extensionCandidate
}

function getLegibleFilename(pathOrUrl: string, maxLength: number): string {
	let legibleFilename: string | undefined

	if (isUrl(pathOrUrl)) {
		const url = new URL(pathOrUrl)
		// Also remove extension from URL if it's there, but it won't always be
		legibleFilename = path.posix.basename(url.pathname, path.posix.extname(url.pathname))
	} else {
		// Must be a file path
		const filePath = pathOrUrl
		legibleFilename = path.posix.basename(filePath, path.posix.extname(filePath))
	}

	// Should never happen
	if (legibleFilename === undefined) {
		throw new Error(`Could not create a legible file name for: ${pathOrUrl}`)
	}

	// Slugify without double-dashes, temporarily convert to spaces for truncation on word boundaries
	return truncateOnWordBoundary(
		slugify(legibleFilename.trim()).replaceAll(/-+/g, '-'),
		maxLength,
		'...',
		'-',
	)
}

export async function mediaAssetExists(
	absolutePathOrUrl: string,
	fileAdapter: FileAdapter,
	fetchAdapter: FetchAdapter,
): Promise<boolean> {
	if (isUrl(absolutePathOrUrl)) {
		return urlExists(absolutePathOrUrl, fetchAdapter)
	}

	return fileExists(absolutePathOrUrl, fileAdapter)
}

// Anki truncates long file names... so we crush the complete path down to a hash

export async function getSafeAnkiMediaFilename(
	absolutePathOrUrl: string,
	namespace: string,
	fileAdapter: FileAdapter,
	fetchAdapter: FetchAdapter,
): Promise<string> {
	// Can be a bit more than max namespace length, since it's always prefixed with `yanki-media-`
	const safeNamespace = getSlugifiedNamespace(namespace)
	const assetHash = await getContentHash(absolutePathOrUrl, fileAdapter, fetchAdapter)
	const rawFileExtension = await getAnkiMediaFilenameExtension(absolutePathOrUrl, fetchAdapter)
	const fileExtension = rawFileExtension === undefined ? '' : `.${rawFileExtension}`

	let safeFilename: string | undefined

	if (MEDIA_INCLUDE_LEGIBLE_FILENAME) {
		// Make the legible filename as long as possible, add in the dash widths, dot is included in the extension
		const legibleFilenameLength =
			MEDIA_FILENAME_MAX_LENGTH -
			(safeNamespace.length + 1 + assetHash.length + 1 + fileExtension.length)

		const legibleFilename = getLegibleFilename(absolutePathOrUrl, legibleFilenameLength)
		// 40 + 1 + 16 + 1 + ? + 1 + 8
		safeFilename = `${safeNamespace}-${assetHash}-${legibleFilename}${fileExtension}`
	} else {
		safeFilename = `${safeNamespace}-${assetHash}${fileExtension}`
	}

	// Should never happen
	if (safeFilename.length > MEDIA_FILENAME_MAX_LENGTH) {
		throw new Error(`Filename too long: ${safeFilename}`)
	}

	return safeFilename
}

async function getContentHash(
	absolutePathOrUrl: string,
	fileAdapter: FileAdapter,
	fetchAdapter: FetchAdapter,
): Promise<string> {
	return isUrl(absolutePathOrUrl)
		? getUrlContentHash(absolutePathOrUrl, fetchAdapter)
		: getFileContentHash(absolutePathOrUrl, fileAdapter)
}

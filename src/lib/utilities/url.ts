/* eslint-disable n/no-unsupported-features/node-builtins */
import {
	MEDIA_ALLOW_UNKNOWN_URL_EXTENSION,
	MEDIA_DEFAULT_HASH_MODE_URL,
	MEDIA_SUPPORTED_AUDIO_VIDEO_EXTENSIONS,
	MEDIA_SUPPORTED_IMAGE_EXTENSIONS,
	MEDIA_URL_CONTENT_TYPE_MODE,
} from '../shared/constants'
import { type FetchAdapter } from '../shared/types'
import { getFileExtensionForMimeType } from './mime'
import { getHash } from './string'

export function isUrl(text: string): boolean {
	// Waiting for URL.canParse in node 19+...
	// return URL.canParse(text)
	try {
		// eslint-disable-next-line no-new
		new URL(text)
		return true
	} catch {
		return false
	}
}

/**
 * Helper to "filter" file URLs into path strings so they're treated
 * correctly in mdastToHtml
 * TODO need stuff from node's implementation, fileURLToPath?
 * @param text
 * @returns
 */

export function fileUrlToPath(text: string): string {
	try {
		const url = new URL(text)
		if (url.protocol === 'file:') {
			return url.pathname
		}

		return text
	} catch {
		return text
	}
}

export function getSrcType(
	text: string,
): 'localFilePath' | 'localFileUrl' | 'remoteHttpUrl' | 'unsupportedProtocolUrl' {
	try {
		const url = new URL(text)
		if (url.protocol === 'file:') {
			return 'localFileUrl'
		}

		if (url.protocol === 'http:' || url.protocol === 'https:') {
			return 'remoteHttpUrl'
		}
	} catch {
		return 'localFilePath'
	}

	return 'unsupportedProtocolUrl'
}

/**
 * Supports both Header type and Record<string, string> type
 * @param headers Headers object or record from a fetch response
 * @param headerKeys Headers to include in the string
 * @returns a concatenated string of the header contents, suitable for hashing, or undefined if no matching headers are present
 */
function getHeadersString(
	headers: Headers | Record<string, string> | undefined,
	headerKeys: string[],
): string | undefined {
	if (headers === undefined) {
		return undefined
	}

	if (!(headers instanceof Headers)) {
		headers = convertKeysToLowercase(headers)
	}

	const headerString = (
		headers instanceof Headers
			? headerKeys.map((key) => headers.get(key))
			: headerKeys.map((key) => headers[key])
	)
		.filter((value) => value !== null && value !== undefined)
		.join('')

	if (headerString === '') {
		return undefined
	}

	return headerString
}

function convertKeysToLowercase(object: Record<string, string>): Record<string, string> {
	const result: Record<string, string> = {}

	for (const [key, value] of Object.entries(object)) {
		result[key.toLowerCase()] = value
	}

	return result
}

export async function getFileExtensionFromUrl(
	url: string,
	fetchAdapter: FetchAdapter | undefined,
	mode = MEDIA_URL_CONTENT_TYPE_MODE,
	allowUnknown = MEDIA_ALLOW_UNKNOWN_URL_EXTENSION,
): Promise<string | undefined> {
	switch (mode) {
		case 'metadata': {
			if (fetchAdapter === undefined) {
				// Fall through to name mode
				return getFileExtensionFromUrl(url, fetchAdapter, 'name')
			}

			try {
				const response = await fetchAdapter(url, { method: 'HEAD' })
				const contentTypeHeaderValue = getHeadersString(response?.headers, ['content-type'])

				if (contentTypeHeaderValue === undefined) {
					throw new Error('No content-type header found')
				}

				return getFileExtensionForMimeType(contentTypeHeaderValue)
			} catch {
				// Fall through to name mode
				return getFileExtensionFromUrl(url, fetchAdapter, 'name')
			}
		}

		case 'name': {
			let extensionInUrl: string | undefined
			const urlObject = new URL(url)

			const pathnameParts = urlObject.pathname.split('.')
			if (pathnameParts.length > 1) {
				extensionInUrl = pathnameParts.at(-1)
			} else {
				// Look in the query string if we must...
				const searchParts = urlObject.search.split('.')
				extensionInUrl = searchParts.at(-1)
			}

			if (
				(
					[
						...MEDIA_SUPPORTED_AUDIO_VIDEO_EXTENSIONS,
						...MEDIA_SUPPORTED_IMAGE_EXTENSIONS,
					] as unknown as string[]
				).includes(extensionInUrl ?? '')
			) {
				return extensionInUrl
			}

			if (allowUnknown) {
				return 'unknown'
			}

			return undefined
		}
	}
}

/**
 * Tradeoffs between content change sensitivity and sync speed / efficiency,
 * especially for remote assets.
 *
 * - `filename`: Use the filename of the media asset, no network required.
 * - `metadata`: Use the metadata of the media asset, either fstat stuff for
 *   files, or reading the headers for URLs... requires a network request for
 *   remote urls. Falls through to `filename` if not available.
 * - `content`: Actually read the content of the media asset, requires reading
 *   the file or fetching the URL. Not yet implemented. Falls through to
 *   `metadata` if not available.
 *
 * @param url
 * @param fetchAdapter
 * @param mode
 * @returns
 */
export async function getUrlContentHash(
	url: string,
	fetchAdapter: FetchAdapter,
	mode = MEDIA_DEFAULT_HASH_MODE_URL,
): Promise<string> {
	// Obliging the no-fallthrough lint rule, but this effectively falls through
	// via recursion instead...
	switch (mode) {
		case 'content': {
			console.warn('`content` hash mode is not yet implemented for URLs')
			// Use metadata mode
			return getUrlContentHash(url, fetchAdapter, 'metadata')
		}

		case 'metadata': {
			try {
				const response = await fetchAdapter(url, { method: 'HEAD' })
				const stringToHash = getHeadersString(response?.headers, [
					'etag',
					'last-modified',
					'content-length',
				])

				if (stringToHash === undefined) {
					throw new Error('No headers found')
				}

				return getHash(stringToHash, 16)
			} catch {
				// Fall through to name mode
				return getUrlContentHash(url, fetchAdapter, 'name')
			}
		}

		case 'name': {
			return getHash(url, 16)
		}
	}
}

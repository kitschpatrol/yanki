/* eslint-disable n/no-unsupported-features/node-builtins */

import {
	MEDIA_DEFAULT_HASH_MODE_URL,
	MEDIA_SUPPORTED_EXTENSIONS,
	MEDIA_URL_CONTENT_TYPE_MODE,
	type MediaSupportedExtension,
} from '../shared/constants'
import { type FetchAdapter } from '../shared/types'
import { getFileExtensionForMimeType } from './mime'
import { isAbsolute, normalize } from './path'
import { getHash } from './string'

// Detect probably wiki-style name links
export function isNameUrl(text: string): boolean {
	// Name links aren't absolute, aren't relative, and aren't URLs
	return !text.startsWith('/') && !text.startsWith('./') && !text.startsWith('../') && !isUrl(text)
}

export function safeDecodeURI(text: string): string | undefined {
	try {
		return decodeURI(text)
	} catch (error) {
		console.warn(`Error decoding URI text: "${text}"`, error)
		return undefined
	}
}

export function safeDecodeURIComponent(text: string): string | undefined {
	try {
		return decodeURIComponent(text)
	} catch (error) {
		console.warn(`Error decoding URI component text: "${text}"`, error)
		return undefined
	}
}

/**
 * @param text
 * @returns URL object if parsable, undefined if not (likely a file path)
 */
export function safeParseUrl(text: string): undefined | URL {
	// Waiting for non-throwing URL.canParse in node 19+...
	// return URL.canParse(text)
	try {
		const url = new URL(text)

		// If a file url is detected, but wasn't explicitly passed via a protocol, then
		// treat it as a file path and not a URL
		const driveLetterPattern = /^[a-z]:/i
		const filePrefixPattern = /^file:/i
		if (
			(filePrefixPattern.test(url.protocol) || driveLetterPattern.test(url.protocol)) &&
			!filePrefixPattern.test(text)
		) {
			return undefined
		}

		return url

		// More notes:
		// Windows file paths can yield protocols like `C:\Bla bla bla` will yield a
		// "protocol" of `c:`... which is theoretically a valid, URL, but almost
		// definitely one we want to treat as a file path instead
		// Plus there are cross platform differences, on Windows file: is
		// prepended as the protocol for URLs that would have protocol c: on macOS.
		// To ensure that explicitly passed `file://` URLs are not wrongly treated as
		// file paths, we have to check the text input as well to infer intent.
	} catch {
		return undefined
	}
}

export function isUrl(text: string): boolean {
	return safeParseUrl(text) !== undefined
}

/**
 * Helper to "filter" file URLs into path strings so they're treated
 * correctly in mdastToHtml
 * TODO need stuff from node's implementation, fileURLToPath?
 * @param url
 * @returns
 */
export function fileUrlToPath(url: string): string {
	const parsedUrl = safeParseUrl(url)
	if (parsedUrl?.protocol === 'file:') {
		return parsedUrl.pathname
	}

	return url
}

export function getSrcType(
	filePathOrUrl: string,
):
	| 'localFileName'
	| 'localFilePath'
	| 'localFileUrl'
	| 'obsidianVaultUrl'
	| 'remoteHttpUrl'
	| 'unsupportedProtocolUrl' {
	const url = safeParseUrl(filePathOrUrl)

	if (url === undefined) {
		// Probably a file path
		const normalizedPath = normalize(filePathOrUrl)

		// Links that are relative or absolute probably aren't wiki-style name links
		// TODO vet this with the normalized paths
		if (
			isAbsolute(normalizedPath) ||
			// Can't use isRelative() since that considered no prefix to be relative
			normalizedPath.startsWith('./') ||
			normalizedPath.startsWith('../')
		) {
			return 'localFilePath'
		}

		return 'localFileName'
	}

	// Probably a url
	if (url.protocol === 'file:') {
		return 'localFileUrl'
	}

	if (url.protocol === 'obsidian:') {
		return 'obsidianVaultUrl'
	}

	if (url.protocol === 'http:' || url.protocol === 'https:') {
		return 'remoteHttpUrl'
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

export async function urlExists(url: string, fetchAdapter: FetchAdapter): Promise<boolean> {
	try {
		const response = await fetchAdapter(url, { method: 'HEAD' })
		// TODO other codes?
		return response?.status === 200
	} catch {
		return false
	}
}

export async function getFileExtensionFromUrl(
	url: string,
	fetchAdapter: FetchAdapter | undefined,
	mode = MEDIA_URL_CONTENT_TYPE_MODE,
): Promise<MediaSupportedExtension | undefined> {
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
			const parsedUrl = safeParseUrl(url)

			if (parsedUrl === undefined) {
				console.warn(`Could not parse URL: ${url}`)
				return undefined
			}

			const pathnameParts = parsedUrl.pathname.split('.')
			if (pathnameParts.length > 1) {
				extensionInUrl = pathnameParts.at(-1)
			} else {
				// Look in the query string if we must...
				const searchParts = parsedUrl.search.split('.')
				extensionInUrl = searchParts.at(-1)
			}

			// TODO get rid of type cast
			if (MEDIA_SUPPORTED_EXTENSIONS.includes((extensionInUrl ?? '') as MediaSupportedExtension)) {
				return extensionInUrl as MediaSupportedExtension
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

export function urlToHostAndPort(url: string): { host: string; port: number } | undefined {
	const parsedUrl = safeParseUrl(url)
	return parsedUrl === undefined
		? undefined
		: {
				host: `${parsedUrl.protocol}//${parsedUrl.hostname}`,
				port: Number.parseInt(parsedUrl.port, 10),
			}
}

export function hostAndPortToUrl(host: string, port: number): string {
	return `${host}:${port}`
}

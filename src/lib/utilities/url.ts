/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable node/no-unsupported-features/node-builtins */

import type { MediaSupportedExtension } from '../shared/constants'
import type { FetchAdapter } from '../shared/types'
import {
	MEDIA_DEFAULT_HASH_MODE_URL,
	MEDIA_SUPPORTED_EXTENSIONS,
	MEDIA_URL_CONTENT_TYPE_MODE,
} from '../shared/constants'
import { getFileExtensionForMimeType } from './mime'
import { isAbsolute, normalize } from './path'
import { getHash } from './string'

const DRIVE_LETTER_REGEX = /^[a-z]:/iv
const FILE_PREFIX_REGEX = /^file:/iv

// Detect probably wiki-style name links
// export function isNameUrl(text: string): boolean {
// 	// Name links aren't absolute, aren't relative, and aren't URLs
// 	return !text.startsWith('/') && !text.startsWith('./') && !text.startsWith('../') && !isUrl(text)
// }

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
 * Parse a string into a URL object if parsable, and return undefined otherwise
 * (e.g. if it's a file path) _instead_ of throwing an error like the native URL
 * constructor does.
 */
export function safeParseUrl(text: string): undefined | URL {
	// Waiting for non-throwing URL.canParse in node 19+...
	// return URL.canParse(text)
	try {
		const url = new URL(text)

		// If a file url is detected, but wasn't explicitly passed via a protocol, then
		// treat it as a file path and not a URL
		if (
			(FILE_PREFIX_REGEX.test(url.protocol) || DRIVE_LETTER_REGEX.test(url.protocol)) &&
			!FILE_PREFIX_REGEX.test(text)
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
 * Helper to "filter" file URLs into path strings so they're treated correctly
 * in mdastToHtml
 *
 * @todo Need stuff from node's implementation, fileURLToPath?
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
 *
 * @param headers Headers object or record from a fetch response
 * @param headerKeys Headers to include in the string
 *
 * @returns A concatenated string of the header contents, suitable for hashing,
 *   or undefined if no matching headers are present
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
		// eslint-disable-next-line ts/no-unnecessary-condition
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
	if (mode === 'metadata' && fetchAdapter !== undefined) {
		try {
			const response = await fetchAdapter(url, { method: 'HEAD' })
			const contentTypeHeaderValue = getHeadersString(response?.headers, ['content-type'])

			if (contentTypeHeaderValue === undefined) {
				throw new Error('No content-type header found')
			}

			const extension = getFileExtensionForMimeType(contentTypeHeaderValue)
			if (extension !== undefined) {
				return extension
			}

			// Unknown mime type, fall through to name mode
		} catch {
			// Fall through to name mode
		}
	}

	// Name mode, also the fallback if metadata mode is unavailable or fails
	const parsedUrl = safeParseUrl(url)

	if (parsedUrl === undefined) {
		console.warn(`Could not parse URL: ${url}`)
		return undefined
	}

	let extensionInUrl: string | undefined
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

/**
 * Tradeoffs between content change sensitivity and sync speed / efficiency,
 * especially for remote assets.
 *
 * - `filename`: Use the filename of the media asset, no network required.
 * - `metadata`: Use the metadata of the media asset, either fstat stuff for
 *   files, or reading the headers for URLs... requires a network request for
 *   remote urls. Falls through to `filename` if not available.
 * - `content`: Actually read the content of the media asset, requires reading the
 *   file or fetching the URL. Not yet implemented. Falls through to `metadata`
 *   if not available.
 */
export async function getUrlContentHash(
	url: string,
	fetchAdapter: FetchAdapter,
	mode = MEDIA_DEFAULT_HASH_MODE_URL,
): Promise<string> {
	if (mode === 'content') {
		console.warn('`content` hash mode is not yet implemented for URLs')
		// Use metadata mode instead
	}

	if (mode !== 'name') {
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
		}
	}

	// Name mode, also the fallback if metadata mode fails
	return getHash(url, 16)
}

// The WHATWG URL parser leaves `URL.port` empty when the port matches the
// protocol's default, so an explicitly-typed default port (e.g. `:443` on
// https) is otherwise silently dropped. Covers all "special schemes" with a
// default port: https://url.spec.whatwg.org/#special-scheme
const DEFAULT_PORT_BY_PROTOCOL: Record<string, number> = {
	'ftp:': 21,
	'http:': 80,
	'https:': 443,
	'ws:': 80,
	'wss:': 443,
}

export function urlToHostAndPort(url: string): undefined | { host: string; port: number } {
	const parsedUrl = safeParseUrl(url)
	if (parsedUrl === undefined) {
		return undefined
	}

	return {
		host: `${parsedUrl.protocol}//${parsedUrl.hostname}`,
		// `URL.port` is empty for the protocol's default port, so recover it from
		// the protocol rather than dropping it. Protocols without a known default
		// yield NaN, preserving the prior behavior for those.
		port:
			parsedUrl.port === ''
				? (DEFAULT_PORT_BY_PROTOCOL[parsedUrl.protocol] ?? NaN)
				: Number(parsedUrl.port),
	}
}

export function hostAndPortToUrl(host: string, port: number): string {
	return `${host}:${port}`
}

/* eslint-disable n/no-unsupported-features/node-builtins */
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
	headers: Headers | Record<string, string>,
	headerKeys: string[],
): string | undefined {
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
	fetchAdapter: FetchAdapter,
): Promise<string | undefined> {
	const response = await fetchAdapter(url, { method: 'HEAD' })

	if (response === undefined) {
		return undefined
	}

	const contentType = getHeadersString(response.headers, ['content-type'])

	if (contentType === undefined) {
		return undefined
	}

	return getFileExtensionForMimeType(contentType)
}

export async function getUrlContentHash(
	url: string,
	fetchAdapter: FetchAdapter,
): Promise<string | undefined> {
	const response = await fetchAdapter(url, { method: 'HEAD' })

	if (response === undefined) {
		return undefined
	}

	const stringToHash = getHeadersString(response.headers, [
		'etag',
		'last-modified',
		'content-length',
	])

	if (stringToHash === undefined) {
		return undefined
	}

	return getHash(stringToHash, 16)
}

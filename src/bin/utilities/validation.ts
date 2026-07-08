import { urlToHostAndPort } from '../../lib/utilities/url'

/**
 * Get host and port components of a URL
 *
 * @param url The AnkiConnect server URL to parse.
 *
 * @returns Host and port
 * @throws {Error} If URL can't be parsed
 */
export function urlToHostAndPortValidated(url: string): { host: string; port: number } {
	const parsedUrl = urlToHostAndPort(url)

	if (parsedUrl === undefined) {
		throw new Error(`Invalid AnkiConnect URL: "${url}"`)
	}

	return parsedUrl
}

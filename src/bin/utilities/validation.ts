import { urlToHostAndPort } from '../../lib/utilities/url'

/**
 * Get host and port components of a URL
 *
 * @param url
 * @returns host and port
 * @throws if URL can't be parsed
 */
export function urlToHostAndPortValidated(url: string): { host: string; port: number } {
	const parsedUrl = urlToHostAndPort(url)

	if (parsedUrl === undefined) {
		throw new Error(`Invalid AnkiConnect URL: "${url}"`)
	}

	return parsedUrl
}

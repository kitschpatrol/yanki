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

	// A NaN port means the protocol has no known default port (e.g. the
	// protocol was omitted entirely, so the host was parsed as a protocol),
	// which would otherwise produce a broken `host:NaN` request URL downstream.
	if (parsedUrl === undefined || Number.isNaN(parsedUrl.port)) {
		throw new Error(`Invalid AnkiConnect URL: "${url}"`)
	}

	return parsedUrl
}

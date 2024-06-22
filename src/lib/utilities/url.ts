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

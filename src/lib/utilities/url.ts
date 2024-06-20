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

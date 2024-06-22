import fnv1a from '@sindresorhus/fnv1a'

// Don't touch this either
export function getHash(text: string, length: 8 | 16): string {
	// Clunky for types
	return fnv1a(text, { size: length === 8 ? 32 : 64 })
		.toString(16)
		.padStart(length, '0')
}

export function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Truncates on word boundary and adds ellipsis. Does not give special treatment
 * to file extensions.
 * @param text Text to truncate
 * @param maxLength Maximum length excluding ellipsis
 * @returns Truncated string
 */
export function truncateOnWordBoundary(
	text: string,
	maxLength: number,
	truncationString = '...',
): string {
	if (text.length <= maxLength) {
		return text
	}

	const maxLengthSafe = maxLength - truncationString.length

	const words = text.split(' ')

	while (words.length > 1 && words.join(' ').length > maxLengthSafe) {
		words.pop()
	}

	// Slice again just in case the text had no spaces...
	return `${words.join(' ').slice(0, maxLengthSafe)}${truncationString}`
}

export function urlToHostAndPort(url: string): { host: string; port: number } {
	const urlObject = new URL(url)

	return {
		host: `${urlObject.protocol}//${urlObject.hostname}`,
		port: Number.parseInt(urlObject.port, 10),
	}
}

export function hostAndPortToUrl(host: string, port: number): string {
	return `${host}:${port}`
}

export function cleanClassName(className: string): string {
	return className
		.toLowerCase()
		.replaceAll(/[^\da-z]/gi, ' ')
		.trim()
		.replaceAll(/ +/g, '-')
}

export function emptyIsUndefined(text: string | undefined): string | undefined {
	if (text === undefined) {
		return undefined
	}

	return text.trim() === '' ? undefined : text
}

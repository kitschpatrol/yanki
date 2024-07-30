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
 * to file extensions. If there are no spaces in the text, it will truncate at
 * `maxLength` without respect for word boundaries.
 * @param text Text to truncate
 * @param maxLength Maximum length excluding ellipsis
 * @param truncationString String to append to truncated text. Defaults to '...'
 * @param wordBoundary Character to consider a word boundary. Defaults to a space.
 * @returns Truncated string
 */
export function truncateOnWordBoundary(
	text: string,
	maxLength: number,
	truncationString = '...',
	wordBoundary = ' ',
): string {
	if (text.length <= maxLength) {
		return text
	}

	const maxLengthSafe = maxLength - truncationString.length
	const words = text.split(wordBoundary)
	while (words.length > 1 && words.join(wordBoundary).length > maxLengthSafe) {
		words.pop()
	}

	// Slice again just in case the text had no spaces...
	return `${words.join(wordBoundary).slice(0, maxLengthSafe)}${truncationString}`
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

/**
 * Mainly for nice formatting with prettier. But the line wrapping means we have to strip surplus whitespace.
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
	return trimLeadingIndentation(strings, ...values)
}

/**
 * Mainly for nice formatting with prettier. But the line wrapping means we have to strip surplus whitespace.
 */
export function css(strings: TemplateStringsArray, ...values: unknown[]): string {
	return trimLeadingIndentation(strings, ...values)
}

function trimLeadingIndentation(strings: TemplateStringsArray, ...values: unknown[]): string {
	const lines = strings
		.reduce((result, text, i) => `${result}${text}${String(values[i] ?? '')}`, '')
		.split(/\r?\n/)
		.filter((line) => line.trim() !== '')

	// Get leading white space of first line, and trim that much white space
	// from subsequent lines
	const leadingSpace = /^(\s+)/.exec(lines[0])?.[0] ?? ''
	const leadingSpaceRegex = new RegExp(`^${leadingSpace}`)
	return lines.map((line) => line.replace(leadingSpaceRegex, '').trimEnd()).join('\n')
}

export function splitAtFirstMatch(text: string, regex: RegExp): [string, string | undefined] {
	// Find the first match of the regex
	const match = text.match(regex)

	if (match?.index === undefined) {
		return [text, undefined] // If no match is found, return the whole string and an empty string
	}

	// Get the position and length of the first match
	const { index } = match

	// Split the string into two parts
	const beforeMatch = text.slice(0, index)
	const afterMatch = text.slice(index)

	return [beforeMatch, afterMatch]
}

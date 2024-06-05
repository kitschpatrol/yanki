import { stripHtml } from 'string-strip-html'

export function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1)
}

export function truncateWithEllipsis(text: string, length: number): string {
	if (text.length <= length) return text
	return text.slice(0, Math.max(0, length - 3)) + '...'
}

export function stripHtmlTags(html: string): string {
	return stripHtml(html).result
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

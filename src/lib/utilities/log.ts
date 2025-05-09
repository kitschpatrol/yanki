/* eslint-disable perfectionist/sort-objects */
// Staying basic, always log to stderr

import pc from 'picocolors'

// eslint-disable-next-line ts/no-unnecessary-condition
const isNode = process?.versions?.node !== undefined

const log = {
	verbose: false,

	// Intended for temporary logging
	log(...data: unknown[]): void {
		if (!this.verbose) return
		const levelPrefix = pc.gray('[Log]')
		if (isNode) {
			// Log to stderr in node for ease of redirection
			console.warn(levelPrefix, ...data)
		} else {
			console.log(levelPrefix, ...data)
		}
	},
	logPrefixed(prefix: string, ...data: unknown[]): void {
		this.info(pc.blue(`[${prefix}]`), ...data)
	},

	info(...data: unknown[]): void {
		if (!this.verbose) return
		const levelPrefix = pc.green('[Info]')
		if (isNode) {
			// Log info to stderr in node for ease of redirection
			console.warn(levelPrefix, ...data)
		} else {
			console.info(levelPrefix, ...data)
		}
	},
	infoPrefixed(prefix: string, ...data: unknown[]): void {
		this.info(pc.blue(`[${prefix}]`), ...data)
	},

	warn(...data: unknown[]): void {
		console.warn(pc.yellow('[Warning]'), ...data)
	},
	warnPrefixed(prefix: string, ...data: unknown[]): void {
		this.warn(pc.blue(`[${prefix}]`), ...data)
	},

	error(...data: unknown[]): void {
		console.error(pc.red('[Error]'), ...data)
	},
	errorPrefixed(prefix: string, ...data: unknown[]): void {
		this.error(pc.blue(`[${prefix}]`), ...data)
	},
}

export default log

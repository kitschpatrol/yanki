/* eslint-disable unicorn/prefer-global-this */
/* eslint-disable node/no-unsupported-features/node-builtins */

export const ENVIRONMENT =
	typeof window === 'undefined' ? (typeof process === 'undefined' ? 'other' : 'node') : 'browser'

export const PLATFORM =
	ENVIRONMENT === 'browser'
		? /windows/i.test(navigator.userAgent)
			? 'windows'
			: /mac/i.test(navigator.userAgent)
				? 'mac'
				: /linux/i.test(navigator.userAgent) || /ubuntu/i.test(navigator.userAgent)
					? 'linux'
					: 'other'
		: ENVIRONMENT === 'node'
			? process.platform === 'win32'
				? 'windows'
				: process.platform === 'darwin'
					? 'mac'
					: process.platform === 'linux'
						? 'linux'
						: 'other'
			: 'other'

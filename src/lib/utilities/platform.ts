/* eslint-disable node/no-unsupported-features/node-builtins */

export const ENVIRONMENT =
	typeof window === 'undefined' ? (typeof process === 'undefined' ? 'other' : 'node') : 'browser'

export const PLATFORM =
	ENVIRONMENT === 'browser'
		? /windows/iv.test(navigator.userAgent)
			? 'windows'
			: /mac/iv.test(navigator.userAgent)
				? 'mac'
				: /linux/iv.test(navigator.userAgent) || /ubuntu/iv.test(navigator.userAgent)
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

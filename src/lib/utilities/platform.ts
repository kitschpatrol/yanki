/* eslint-disable node/no-unsupported-features/node-builtins */

export const ENVIRONMENT =
	typeof window === 'undefined' ? (typeof process === 'undefined' ? 'other' : 'node') : 'browser'

export const PLATFORM =
	ENVIRONMENT === 'browser'
		? /windows/iu.test(navigator.userAgent)
			? 'windows'
			: /mac/iu.test(navigator.userAgent)
				? 'mac'
				: /linux/iu.test(navigator.userAgent) || /ubuntu/iu.test(navigator.userAgent)
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

export const ENVIRONMENT =
	typeof window === 'undefined' ? (typeof process === 'undefined' ? 'other' : 'node') : 'browser'

export const PLATFORM =
	ENVIRONMENT === 'browser'
		? // eslint-disable-next-line n/no-unsupported-features/node-builtins
			/windows/i.test(navigator.userAgent)
			? 'windows'
			: // eslint-disable-next-line n/no-unsupported-features/node-builtins
				/mac/i.test(navigator.userAgent)
				? 'mac'
				: 'other'
		: ENVIRONMENT === 'node'
			? process.platform === 'win32'
				? 'windows'
				: process.platform === 'darwin'
					? 'mac'
					: 'other'
			: 'other'

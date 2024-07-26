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
				: // eslint-disable-next-line n/no-unsupported-features/node-builtins
					/linux/i.test(navigator.userAgent) || /ubuntu/i.test(navigator.userAgent)
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

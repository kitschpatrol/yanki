export const environment =
	typeof window === 'undefined' ? (typeof process === 'undefined' ? 'other' : 'node') : 'browser'

export const platform =
	environment === 'browser'
		? /windows/i.test(navigator.userAgent)
			? 'windows'
			: /mac/i.test(navigator.userAgent)
				? 'mac'
				: 'other'
		: environment === 'node'
			? process.platform === 'win32'
				? 'windows'
				: process.platform === 'darwin'
					? 'mac'
					: 'other'
			: 'other'

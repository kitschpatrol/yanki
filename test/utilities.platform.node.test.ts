import { expect, it } from 'vitest'
import { ENVIRONMENT, PLATFORM } from '../src/lib/utilities/platform'

it('detects node environment', () => {
	expect(ENVIRONMENT).toBe('node')
})

it('detects the current platform', () => {
	expect(['windows', 'mac', 'linux', 'other']).toContain(PLATFORM)
})

it('maps node process.platform to PLATFORM correctly', () => {
	const expected =
		process.platform === 'win32'
			? 'windows'
			: process.platform === 'darwin'
				? 'mac'
				: process.platform === 'linux'
					? 'linux'
					: 'other'
	expect(PLATFORM).toBe(expected)
})

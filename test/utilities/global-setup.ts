import fs from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { TEST_PROFILE_NAME } from '../utilities/test-constants'
import { closeAnki, openAnki } from './anki-connect'

function getAnkiProfilePath(profileName: string): string {
	const home = homedir()
	switch (process.platform) {
		case 'darwin': {
			return join(home, 'Library', 'Application Support', 'Anki2', profileName)
		}
		case 'freebsd':
		case 'linux': {
			return join(process.env.XDG_DATA_HOME ?? join(home, '.local', 'share'), 'Anki2', profileName)
		}
		case 'win32': {
			return join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Anki2', profileName)
		}
		case 'aix': {
			throw new Error('Not implemented yet: "aix" case')
		}
		case 'android': {
			throw new Error('Not implemented yet: "android" case')
		}
		case 'haiku': {
			throw new Error('Not implemented yet: "haiku" case')
		}
		case 'openbsd': {
			throw new Error('Not implemented yet: "openbsd" case')
		}
		case 'sunos': {
			throw new Error('Not implemented yet: "sunos" case')
		}
		case 'cygwin': {
			throw new Error('Not implemented yet: "cygwin" case')
		}
		case 'netbsd': {
			throw new Error('Not implemented yet: "netbsd" case')
		}
	}
}

/**
 * Ensure Anki is running before tests run
 */
export async function setup() {
	// Close Anki if running, then reset the test profile for repeatable tests
	await closeAnki()

	// Sleep for a bit, some issues with file writing latency
	await new Promise((resolve) => {
		setTimeout(resolve, 1000)
	})

	const profilePath = getAnkiProfilePath(TEST_PROFILE_NAME)
	await fs.rm(profilePath, { force: true, recursive: true })
	await fs.mkdir(profilePath, { recursive: true })

	// Sleep for a bit, some issues with file writing latency
	await new Promise((resolve) => {
		setTimeout(resolve, 1000)
	})

	await openAnki()
}

/**
 * Clean up
 */
export async function teardown() {
	await closeAnki()
}

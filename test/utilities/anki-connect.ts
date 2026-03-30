import { execa } from 'execa'
import { YankiConnect } from 'yanki-connect'
import { yankiModels } from '../../src/lib/model/model'
import { requestPermission } from '../../src/lib/utilities/anki-connect'
import { PLATFORM } from '../../src/lib/utilities/platform'
import { TEST_PROFILE_NAME } from './test-constants'

/**
 * Launches Anki with a custom base directory.
 */
export async function openAnki(basePath: string): Promise<void> {
	switch (PLATFORM) {
		case 'mac': {
			await execa('open', [
				'/Applications/Anki.app',
				'--args',
				'-b',
				basePath,
				'-p',
				TEST_PROFILE_NAME,
			])
			break
		}

		case 'linux': {
			// TODO: Launch `anki -b basePath -p TEST_PROFILE_NAME` detached so it
			// doesn't block the test process. Ensure the child is unref'd.
			// Example: execa('anki', ['-b', basePath, '-p', TEST_PROFILE_NAME], { detached: true, stdio: 'ignore' }).unref()
			throw new Error('Not implemented yet: launching Anki on Linux')
		}

		case 'windows': {
			// TODO: Launch Anki via its exe. The default install path is
			// C:\Program Files\Anki\anki.exe but may vary. Consider searching
			// PATH or common install locations.
			// Example: execa('anki.exe', ['-b', basePath, '-p', TEST_PROFILE_NAME], { detached: true, stdio: 'ignore' }).unref()
			throw new Error('Not implemented yet: launching Anki on Windows')
		}

		case 'other': {
			throw new Error('Unsupported platform')
		}
	}

	// Poll until AnkiConnect is reachable
	const client = new YankiConnect({ autoLaunch: false })
	const maxWait = 30_000
	const start = Date.now()
	while (Date.now() - start < maxWait) {
		try {
			await client.miscellaneous.version()
			return
		} catch {
			await new Promise((resolve) => {
				setTimeout(resolve, 500)
			})
		}
	}

	throw new Error('Anki did not become reachable within 30s')
}

/**
 * Closes Anki by sending a quit command to the application.
 * Waits until AnkiConnect is unreachable before returning.
 */
export async function closeAnki(): Promise<void> {
	const client = new YankiConnect({
		autoLaunch: false,
	})

	let permissionStatus = await requestPermission(client)
	if (permissionStatus !== 'ankiUnreachable') {
		switch (PLATFORM) {
			case 'mac': {
				await execa('osascript', ['-e', 'tell application "Anki" to quit']).catch(async () => {
					await execa('sh', [
						'-c',
						"launchctl stop $(launchctl list | grep ankiweb | awk '{print $3}')",
					]).catch(() => {
						// Ignore
					})
				})
				break
			}

			case 'linux': {
				// TODO: Send SIGTERM to the Anki process.
				// Example: execa('pkill', ['-f', 'anki'])
				throw new Error('Not implemented yet: closing Anki on Linux')
			}

			case 'windows': {
				// TODO: Kill the Anki process.
				// Example: execa('taskkill', ['/IM', 'anki.exe'])
				throw new Error('Not implemented yet: closing Anki on Windows')
			}

			case 'other': {
				throw new Error('Unsupported platform')
			}
		}
	}

	// Spin until it's done (platform-agnostic via AnkiConnect HTTP)
	while (permissionStatus !== 'ankiUnreachable') {
		await new Promise((resolve) => {
			setTimeout(resolve, 250)
		})
		permissionStatus = await requestPermission(client)
	}
}

/**
 * For testing purposes only
 */
export async function loadTestProfile(client: YankiConnect, testProfileName: string) {
	// Use test profile
	const loadProfileResult = await client.miscellaneous.loadProfile({
		name: testProfileName,
	})

	// eslint-disable-next-line ts/no-unnecessary-condition
	if (!loadProfileResult) {
		throw new Error('Could not load test profile')
	}
}

/**
 * For testing purposes only
 */
export async function createModels(client: YankiConnect) {
	for (const model of yankiModels) {
		try {
			await client.model.createModel(model)
		} catch (error) {
			if (error instanceof Error) {
				if (error.message === `Model name already exists`) {
					continue
				}

				throw error
			} else {
				throw new TypeError('Unknown error')
			}
		}
	}
}

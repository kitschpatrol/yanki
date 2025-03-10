import { execa } from 'execa'
import { YankiConnect } from 'yanki-connect'
import { yankiModels } from '../../src/lib/model/model'
import { requestPermission } from '../../src/lib/utilities/anki-connect'
import { PLATFORM } from '../../src/lib/utilities/platform'

/**
 * Closes Anki by sending a quit command to the application.
 * This function will wait until Anki is unreachable.
 *
 * This function only works on Mac.
 */
export async function closeAnki(): Promise<void> {
	if (PLATFORM !== 'mac') {
		throw new Error('This function only works on Mac')
	}

	// Wait until Anki is unreachable
	const client = new YankiConnect({
		autoLaunch: false,
	})

	let permissionStatus: string | undefined
	while (permissionStatus !== 'ankiUnreachable') {
		// For some reason the provided Anki-Connect endpoint doesn't work, at least
		// on Mac
		// await client.graphical.guiExitAnki()
		await execa('osascript', ['-e', 'tell application "Anki" to quit']).catch(() => {
			// Ignore errors
		})
		await new Promise((resolve) => {
			setTimeout(resolve, 1000)
		})
		permissionStatus = await requestPermission(client)
	}
}

/**
 * For testing purposes only
 */
export async function loadTestProfile(client: YankiConnect) {
	// Use test profile
	const loadProfileResult = await client.miscellaneous.loadProfile({
		name: 'yanki-tests',
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

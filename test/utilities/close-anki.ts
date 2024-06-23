import { requestPermission } from '../../src/lib/utilities/anki-connect'
import { platform } from '../../src/lib/utilities/platform'
import { execa } from 'execa'
import { YankiConnect } from 'yanki-connect'

export async function closeAnki(): Promise<void> {
	if (platform !== 'mac') {
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

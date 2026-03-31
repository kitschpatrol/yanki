import { execa } from 'execa'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { YankiConnect } from 'yanki-connect'
import { yankiModels } from '../../src/lib/model/model'
import { requestPermission } from '../../src/lib/utilities/anki-connect'
import { PLATFORM } from '../../src/lib/utilities/platform'
import { TEST_PROFILE_NAME } from './test-constants'

let ankiPid: number | undefined

/**
 * Finds the Anki executable on Windows by checking common installation locations.
 */
function findAnkiWindows(): string {
	const userProfile = os.homedir()
	const candidates = [
		// Scoop installation
		path.join(
			userProfile,
			'scoop',
			'apps',
			'anki',
			'current',
			'programfiles',
			'.venv',
			'Scripts',
			'anki.exe',
		),
		// Regular installer
		path.join('C:', 'Program Files', 'Anki', 'anki.exe'),
	]

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate
		}
	}

	// Fallback: hope it's on PATH (chocolatey, manual install, etc.)
	// Return bare command and let execa resolve it
	return 'anki'
}

/**
 * Finds the Anki executable on Linux by checking common installation locations.
 */
function findAnkiLinux(): string {
	const candidates = [
		'/usr/local/bin/anki',
		'/usr/bin/anki',
		path.join(os.homedir(), '.local', 'bin', 'anki'),
	]

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate
		}
	}

	// Fallback: hope it's on PATH
	return 'anki'
}

/**
 * Launches Anki with a custom base directory.
 */
export async function openAnki(basePath: string): Promise<void> {
	switch (PLATFORM) {
		case 'linux': {
			const ankiPath = findAnkiLinux()
			const child = execa(ankiPath, ['-b', basePath, '-p', TEST_PROFILE_NAME], {
				detached: true,
				stdio: 'ignore',
			})

			// Suppress the expected rejection when Anki is killed during teardown
			child.catch(() => {
				// Expected: process is killed during closeAnki
			})
			ankiPid = child.pid
			child.unref()
			break
		}

		case 'mac': {
			if (fs.existsSync('/Applications/Anki.app')) {
				await execa('open', [
					'/Applications/Anki.app',
					'--args',
					'-b',
					basePath,
					'-p',
					TEST_PROFILE_NAME,
				])
			} else {
				// Pip-installed Anki (no .app bundle), launch directly like Linux
				const child = execa('anki', ['-b', basePath, '-p', TEST_PROFILE_NAME], {
					detached: true,
					stdio: 'ignore',
				})

				child.catch(() => {
					// Expected: process is killed during closeAnki
				})
				ankiPid = child.pid
				child.unref()
			}

			break
		}

		case 'windows': {
			const ankiPath = findAnkiWindows()
			const child = execa(ankiPath, ['-b', basePath, '-p', TEST_PROFILE_NAME], {
				detached: true,
				stdio: 'ignore',
				windowsHide: true,
			})

			// Suppress the expected rejection when Anki is killed during teardown
			child.catch(() => {
				// Expected: process is killed via taskkill during closeAnki
			})
			ankiPid = child.pid
			child.unref()
			break
		}

		case 'other': {
			throw new Error('Unsupported platform')
		}
	}

	// Poll until AnkiConnect is reachable
	const client = new YankiConnect({ autoLaunch: false })
	// Allow CI to override the timeout (e.g. for launcher first-run download)
	const maxWait = Number(process.env.ANKI_CONNECT_TIMEOUT) || 30_000
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

	throw new Error(`Anki did not become reachable within ${String(maxWait / 1000)}s`)
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
			case 'linux': {
				if (ankiPid !== undefined) {
					// Kill the entire process group (negative PID) so
					// Qt/WebEngine child processes are also terminated
					try {
						process.kill(-ankiPid, 'SIGKILL')
					} catch {
						// Ignore if process group already exited
					}

					ankiPid = undefined
				}

				// Fallback: kill any remaining anki processes by exact name
				// Using -x for exact match to avoid killing unrelated processes
				// (e.g. vitest workers in a directory path containing "anki")
				await execa('pkill', ['-x', 'anki']).catch(() => {
					// Ignore if no matching processes
				})
				break
			}

			case 'mac': {
				if (ankiPid === undefined) {
					// .app bundle: use AppleScript
					await execa('osascript', ['-e', 'tell application "Anki" to quit']).catch(async () => {
						await execa('sh', [
							'-c',
							"launchctl stop $(launchctl list | grep ankiweb | awk '{print $3}')",
						]).catch(() => {
							// Ignore
						})
					})
				} else {
					// Kill the entire process group (negative PID)
					// so Qt/WebEngine child processes are also terminated
					try {
						process.kill(-ankiPid, 'SIGKILL')
					} catch {
						// Ignore if process group already exited
					}

					ankiPid = undefined
				}

				// Fallback for pip-installed Anki where ankiPid is unavailable
				// (e.g. in Vitest worker processes that don't share module state
				// with the global setup). Matches the script path to avoid killing
				// unrelated processes.
				await execa('pkill', ['-9', '-f', 'bin/anki']).catch(() => {
					// Ignore if no matching processes
				})
				break
			}

			case 'windows': {
				// Kill the exact process tree we started (catches Python + Qt children)
				if (ankiPid !== undefined) {
					await execa('taskkill', ['/PID', String(ankiPid), '/T', '/F']).catch(() => {
						// Ignore if process already exited
					})
					ankiPid = undefined
				}

				// Also kill any remaining anki processes by name as a fallback
				await execa('taskkill', ['/IM', 'anki.exe', '/T', '/F']).catch(() => {
					// Ignore if no matching processes
				})
				break
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

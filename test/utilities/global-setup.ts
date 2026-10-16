import type { TestProject } from 'vitest/node'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { closeAnki, openAnki } from './anki-connect'

// Each version has a matching `test/fixtures/anki-data-folder-*` directory
const ANKI_CONNECT_VERSIONS = ['25.11.9.0', '26.10.14.0']

let ankiBasePath: string | undefined

/**
 * Select the AnkiConnect fixture to test from `ANKI_CONNECT_VERSION`,
 * defaulting to the newest. Anki holds one collection at a time, so a run
 * covers a single version and CI runs each one in its own job.
 */
function getAnkiConnectVersion(): string {
	const version = process.env.ANKI_CONNECT_VERSION ?? ANKI_CONNECT_VERSIONS.at(-1)!

	if (!ANKI_CONNECT_VERSIONS.includes(version)) {
		throw new Error(
			`Unsupported ANKI_CONNECT_VERSION: ${version}. Expected ${ANKI_CONNECT_VERSIONS.join(', ')}.`,
		)
	}

	return version
}

/**
 * Ensure Anki is running before tests run, using the preconfigured fixture for
 * the selected AnkiConnect version.
 */
export async function setup(project: TestProject) {
	const ankiConnectVersion = getAnkiConnectVersion()
	const fixturePath = path.resolve(`test/fixtures/anki-data-folder-${ankiConnectVersion}`)
	await fs.access(fixturePath)

	// Close Anki if running
	await closeAnki()

	// Sleep for a bit, some issues with file writing latency
	await new Promise((resolve) => {
		setTimeout(resolve, 1000)
	})

	// Copy the fixture to a temp directory so Anki's writes don't mutate it
	ankiBasePath = await fs.mkdtemp(path.join(os.tmpdir(), 'yanki-test-'))

	await fs.cp(fixturePath, ankiBasePath, { recursive: true })

	// Sleep for a bit, some issues with file writing latency
	await new Promise((resolve) => {
		setTimeout(resolve, 1000)
	})

	project.provide('ankiBasePath', ankiBasePath)
	project.provide('ankiConnectVersion', ankiConnectVersion)

	await openAnki(ankiBasePath)
}

/**
 * Clean up
 */
export async function teardown() {
	await closeAnki()

	if (ankiBasePath !== undefined) {
		await fs.rm(ankiBasePath, { force: true, recursive: true })
	}
}

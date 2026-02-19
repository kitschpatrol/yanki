import { closeAnki, openAnki } from './anki-connect'

/**
 * Ensure Anki is running before tests run
 */
export async function setup() {
	await openAnki()
}

/**
 * Clean up
 */
export async function teardown() {
	await closeAnki()
}

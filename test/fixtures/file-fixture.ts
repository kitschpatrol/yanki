/**
 * Provides a test fixture that copies a directory of markdown files to a
 * temporary directory for mutation tests, and manages Yanki Connect clean up, start up, and
 * teardown.
 */

import { cleanNotes } from '../../src/lib'
import { globby } from 'globby'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect } from 'vitest'
import { YankiConnect } from 'yanki-connect'

type FixtureOptions = {
	assetPath: string
	cleanUpAnki: boolean
}

type TestContext = {
	assetPath: string
	files: string[]
	namespace: string
	yankiConnect: YankiConnect
}

export function describeWithFileFixture(
	description: string,
	{ assetPath, cleanUpAnki }: FixtureOptions,
	tests: (context: TestContext) => void,
) {
	describe(description, () => {
		const context: TestContext = {
			assetPath: '',
			files: [],
			namespace: `Yanki Test - ${description}`,
			yankiConnect: new YankiConnect({ autoLaunch: true }),
		}
		let tempAssetPath: string
		let initialCardCount: number

		beforeAll(async () => {
			// Setup logic before all tests
			context.assetPath = assetPath
			tempAssetPath = path.join(os.tmpdir(), Date.now().toString(), path.basename(assetPath))
			await fs.cp(assetPath, tempAssetPath, { force: true, recursive: true })
			context.files = await globby(`${tempAssetPath}/**/*.md`)
			expect(context.files.length).toBeGreaterThan(0)

			// Clean up anki first
			if (cleanUpAnki) {
				await cleanNotes({
					ankiConnectOptions: { autoLaunch: true },
					dryRun: false,
					namespace: context.namespace,
				})
				const allNotes = await context.yankiConnect.note.findNotes({
					query: '*',
				})
				initialCardCount = allNotes.length
			}

			// Setup logic before all tests
			// console.log(`Setup before all tests: ${JSON.stringify(context, undefined, 2)}`)
		})

		// Call the tests functions, pass the context
		tests(context)

		afterAll(async () => {
			// Teardown logic after all tests
			// console.log(`Teardown after all tests: ${JSON.stringify(context, undefined, 2)}`)

			// Clean up anki
			if (cleanUpAnki) {
				await cleanNotes({
					ankiConnectOptions: { autoLaunch: true },
					dryRun: false,
					namespace: context.namespace,
				})
				const allNotes = await context.yankiConnect.note.findNotes({ query: '*' })
				const finalCardCount = allNotes.length

				expect(initialCardCount).toEqual(finalCardCount)
			}

			// Clean up temp dir
			await fs.rm(tempAssetPath, { force: true, recursive: true })
		})
	})
}

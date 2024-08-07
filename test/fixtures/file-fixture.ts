/**
 * Provides a test fixture that copies a directory of markdown files to a
 * temporary directory for mutation tests, and manages Yanki Connect clean up, start up, and
 * teardown.
 */

import { cleanNotes } from '../../src/lib'
import { yankiModelNames } from '../../src/lib/model/model'
import { CSS_DEFAULT_STYLE } from '../../src/lib/shared/constants'
import { createModels, getModelStyle, updateModelStyle } from '../../src/lib/utilities/anki-connect'
import { normalize } from '../../src/lib/utilities/path'
import { getHash } from '../../src/lib/utilities/string'
import { globby } from 'globby'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'path-browserify-esm'
import { afterAll, beforeAll, describe, expect } from 'vitest'
import { YankiConnect } from 'yanki-connect'

type FixtureOptions = {
	assetPath: string
	cleanUpAnki?: boolean
	cleanUpTempFiles?: boolean
}

type TestContext = {
	allFiles: string[]
	assetPath: string
	markdownFiles: string[]
	namespace: string
	tempAssetPath: string
	yankiConnect: YankiConnect
}

export function describeWithFileFixture(
	description: string,
	{ assetPath, cleanUpAnki = true, cleanUpTempFiles = true }: FixtureOptions,
	tests: (context: TestContext) => void,
) {
	describe(description, () => {
		const context: TestContext = {
			allFiles: [],
			assetPath: '',
			markdownFiles: [],
			namespace: `Yanki Test - ${getHash(description, 16)}`,
			tempAssetPath: '',
			yankiConnect: new YankiConnect({ autoLaunch: true }),
		}

		let initialCardCount: number
		let originalCss: string

		beforeAll(async () => {
			// Setup logic before all tests
			context.assetPath = assetPath
			context.tempAssetPath = path.posix.join(
				os.tmpdir(),
				Date.now().toString(),
				path.posix.basename(assetPath),
			)

			// Copy the asset path to a temp directory
			// eslint-disable-next-line n/no-unsupported-features/node-builtins
			await fs.cp(context.assetPath, context.tempAssetPath, {
				force: true,
				preserveTimestamps: true,
				recursive: true,
			})

			// Sync files and rename files will do path normalization internally,
			// so we don't do it here for better and more representative test path hygiene
			context.markdownFiles = await globby(`${normalize(context.tempAssetPath)}/**/*.md`, {
				absolute: true,
			})

			// Same as above
			context.allFiles = await globby(`${normalize(context.tempAssetPath)}/**/*`, {
				absolute: true,
			})

			expect(context.markdownFiles.length).toBeGreaterThan(0)
			expect(context.allFiles.length).toBeGreaterThan(0)

			// Save CSS, so that we're always using the same stuff
			await createModels(context.yankiConnect)
			originalCss = await getModelStyle(context.yankiConnect)

			// Set default CSS
			for (const name of yankiModelNames) {
				await updateModelStyle(context.yankiConnect, name, CSS_DEFAULT_STYLE, false)
			}

			// Clean up anki first
			if (cleanUpAnki) {
				await cleanNotes({
					ankiConnectOptions: { autoLaunch: true },
					ankiWeb: false,
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

			// Sleep for 2 seconds, some issues with file writing latency
			await new Promise((resolve) => {
				setTimeout(resolve, 1000)
			})

			// Set default CSS
			for (const name of yankiModelNames) {
				await updateModelStyle(context.yankiConnect, name, originalCss, false)
			}

			// Clean up anki
			if (cleanUpAnki) {
				await cleanNotes({
					ankiConnectOptions: { autoLaunch: true },
					ankiWeb: false,
					dryRun: false,
					namespace: context.namespace,
				})
				const allNotes = await context.yankiConnect.note.findNotes({ query: '*' })
				const finalCardCount = allNotes.length

				expect(initialCardCount).toEqual(finalCardCount)
			}

			// Clean up temp dir
			if (cleanUpTempFiles) {
				await fs.rm(context.tempAssetPath, { force: true, recursive: true })
			}
		})
	})
}

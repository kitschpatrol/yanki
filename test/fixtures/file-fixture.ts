/**
 * Provides a test fixture that copies a directory of markdown files to a
 * temporary directory for mutation tests, and manages Yanki Connect clean up, start up, and
 * teardown.
 */

import { globby } from 'globby'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'path-browserify-esm'
import { afterAll, beforeAll, describe, expect } from 'vitest'
import { YankiConnect } from 'yanki-connect'
import { normalize } from '../../src/lib/utilities/path'
import { getHash } from '../../src/lib/utilities/string'
import { loadTestProfile } from '../utilities/anki-connect'

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

			// Use test profile
			await loadTestProfile(context.yankiConnect)

			// Clean up anki first
			if (cleanUpAnki) {
				// Clean up everything, since importing apkg can have other effects...
				const deckNamesResult = await context.yankiConnect.deck.deckNames()
				await context.yankiConnect.deck.deleteDecks({
					cardsToo: true,
					decks: deckNamesResult,
				})
				const deckNamesResultPostClean = await context.yankiConnect.deck.deckNames()
				expect(deckNamesResultPostClean).toEqual(['Default'])

				// Models
			}

			// Setup logic before all tests
			// console.log(`Setup before all tests: ${JSON.stringify(context, undefined, 2)}`)
		})

		// Call the tests functions, pass the context
		tests(context)

		afterAll(async () => {
			// Teardown logic after all tests
			// console.log(`Teardown after all tests: ${JSON.stringify(context, undefined, 2)}`)

			// Sleep for a bit, some issues with file writing latency
			await new Promise((resolve) => {
				setTimeout(resolve, 1000)
			})

			// Clean up anki
			if (cleanUpAnki) {
				// Clean up everything, since importing apkg can have other effects...
				const deckNamesResult = await context.yankiConnect.deck.deckNames()
				await context.yankiConnect.deck.deleteDecks({
					cardsToo: true,
					decks: deckNamesResult,
				})
				const deckNamesResultPostClean = await context.yankiConnect.deck.deckNames()
				expect(deckNamesResultPostClean).toEqual(['Default'])
			}

			// Clean up temp dir
			if (cleanUpTempFiles) {
				await fs.rm(context.tempAssetPath, { force: true, recursive: true })
			}
		})
	})
}

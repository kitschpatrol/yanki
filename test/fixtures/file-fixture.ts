// MyFixture.ts
import { clean } from '../../src/lib'
import { globby } from 'globby'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect } from 'vitest'
import { YankiConnect } from 'yanki-connect'

type FixtureOptions = {
	assetPath: string
	cleanUpAnki: boolean
	testModelPrefix: string
}

type TestContext = {
	files: string[]
	testModelPrefix: string
	yankiConnect: YankiConnect
}

export function describeWithFileFixture(
	description: string,
	{ assetPath, cleanUpAnki, testModelPrefix }: FixtureOptions,
	tests: (context: TestContext) => void,
) {
	describe(description, () => {
		const context: TestContext = {
			files: [],
			testModelPrefix: 'YankiTestUndefined - ',
			yankiConnect: new YankiConnect(),
		}
		let tempAssetPath: string
		let initialCardCount: number

		beforeAll(async () => {
			// Setup logic before all tests
			tempAssetPath = path.join(os.tmpdir(), Date.now().toString(), path.basename(assetPath))
			await fs.cp(assetPath, tempAssetPath, { force: true, recursive: true })
			context.files = await globby(`${tempAssetPath}/**/*.md`)
			expect(context.files.length).toBeGreaterThan(0)

			// Expose the model prefix to the contest
			context.testModelPrefix = testModelPrefix

			// Clean up anki first
			if (cleanUpAnki) {
				await clean({ dryRun: false, modelPrefix: testModelPrefix })
				const allNotes = await context.yankiConnect.note.findNotes({
					query: `deck:"${testModelPrefix}"`,
				})
				initialCardCount = allNotes.length
			}

			console.log(`Setup before all tests: ${JSON.stringify(context, undefined, 2)}`)
		})

		// Call the tests function and pass the context to it
		tests(context)

		afterAll(async () => {
			// Teardown logic after all tests
			console.log(`Teardown after all tests: ${JSON.stringify(context, undefined, 2)}`)

			// Clean up anki
			if (cleanUpAnki) {
				await clean({ dryRun: false, modelPrefix: testModelPrefix })
				const allNotes = await context.yankiConnect.note.findNotes({ query: `*` })
				const finalCardCount = allNotes.length

				expect(initialCardCount).toEqual(finalCardCount)
			}

			// Clean up temp dir
			await fs.rm(tempAssetPath, { force: true, recursive: true })
		})
	})
}

import { expect, it } from 'vitest'
import { formatSetStyleResult, getStyle, setStyle } from '../src/lib'
import { css } from '../src/lib/utilities/string'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { createModels } from './utilities/anki-connect'
import { stablePrettyMs } from './utilities/stable-sync-results'

// Handles resetting any modified CSS
describeWithFileFixture(
	'media',
	{
		assetPath: './test/assets/test-media/', // Unused
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('gets the current style', async () => {
			await createModels(context.yankiConnect)

			const result = await getStyle({
				ankiConnectOptions: {
					autoLaunch: true,
				},
			})

			expect(result).toMatchInlineSnapshot(`
				".card {
				    font-family: arial;
				    font-size: 20px;
				    line-height: 1.5;
				    text-align: center;
				    color: black;
				    background-color: white;
				}
				"
			`)
		})

		it('sets the style', async () => {
			await createModels(context.yankiConnect)

			const customStyle = css`
				.card {
					font-family: monospace;
					font-size: 200px;
					text-align: left;
					color: blue;
					background-color: gray;
				}
			`

			const result = await setStyle({
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				css: customStyle,
			})

			expect(result.models).toMatchInlineSnapshot(`
				[
				  {
				    "action": "updated",
				    "name": "Yanki - Basic",
				  },
				  {
				    "action": "updated",
				    "name": "Yanki - Cloze",
				  },
				  {
				    "action": "updated",
				    "name": "Yanki - Basic (type in the answer)",
				  },
				  {
				    "action": "updated",
				    "name": "Yanki - Basic (and reversed card with extra)",
				  },
				]
			`)

			const resultReport = formatSetStyleResult(result)
			expect(stablePrettyMs(resultReport)).toMatchInlineSnapshot(
				`"Successfully update 4 models and left 0 models unchanged in XXX."`,
			)

			const verboseResultReport = formatSetStyleResult(result, true)
			expect(stablePrettyMs(verboseResultReport)).toMatchInlineSnapshot(`
				"Successfully update 4 models and left 0 models unchanged in XXX.

				Updated models:
				  Yanki - Basic
				  Yanki - Cloze
				  Yanki - Basic (type in the answer)
				  Yanki - Basic (and reversed card with extra)"
			`)

			const newStyle = await getStyle({
				ankiConnectOptions: {
					autoLaunch: true,
				},
			})

			expect(newStyle).toEqual(customStyle)
		})
	},
)

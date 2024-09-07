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
					font-family: monospace;
					font-size: 200px;
					text-align: left;
					color: blue;
					background-color: gray;
				}"
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
				    "action": "unchanged",
				    "name": "Yanki - Basic",
				  },
				  {
				    "action": "unchanged",
				    "name": "Yanki - Cloze",
				  },
				  {
				    "action": "unchanged",
				    "name": "Yanki - Basic (type in the answer)",
				  },
				  {
				    "action": "unchanged",
				    "name": "Yanki - Basic (and reversed card with extra)",
				  },
				]
			`)

			const resultReport = formatSetStyleResult(result)
			expect(stablePrettyMs(resultReport)).toMatchInlineSnapshot(
				`"Successfully update 0 models and left 4 models unchanged in XXX."`,
			)

			const verboseResultReport = formatSetStyleResult(result, true)
			expect(stablePrettyMs(verboseResultReport)).toMatchInlineSnapshot(`
				"Successfully update 0 models and left 4 models unchanged in XXX.

				Unchanged models:
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

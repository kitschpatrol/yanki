import { yankiDefaultCss } from '../model/constants'
import { yankiModelNames } from '../model/model'
import { type GlobalOptions, defaultGlobalOptions } from '../shared/types'
import { requestPermission, updateModelStyle } from '../utilities/anki-connect'
import { deepmerge } from 'deepmerge-ts'
import plur from 'plur'
import prettyMilliseconds from 'pretty-ms'
import type { PartialDeep, Simplify } from 'type-fest'
import { YankiConnect } from 'yanki-connect'

export type StyleOptions = {
	css: string
} & Pick<
	GlobalOptions,
	'ankiConnectOptions' | 'ankiWeb' | 'dryRun' | 'syncToAnkiWebEvenIfUnchanged'
>

export const defaultStyleOptions: StyleOptions = {
	css: yankiDefaultCss,
	...defaultGlobalOptions,
}

export type StyleResult = Simplify<
	{
		duration: number
		models: Array<{
			action: 'unchanged' | 'updated'
			name: string
		}>
	} & Pick<GlobalOptions, 'ankiWeb' | 'dryRun'>
>

export async function setStyle(options: PartialDeep<StyleOptions>): Promise<StyleResult> {
	const startTime = performance.now()

	// Defaults
	const { ankiConnectOptions, ankiWeb, css, dryRun, syncToAnkiWebEvenIfUnchanged } = deepmerge(
		defaultStyleOptions,
		options ?? {},
	) as StyleOptions

	const client = new YankiConnect(ankiConnectOptions)

	const permissionStatus = await requestPermission(client)
	if (permissionStatus === 'ankiUnreachable') {
		throw new Error('Anki is unreachable. Is Anki running?')
	}

	const modelsReport: StyleResult['models'] = []

	for (const modelName of yankiModelNames) {
		const updated = await updateModelStyle(client, modelName, css, dryRun)

		modelsReport.push({
			action: updated ? 'updated' : 'unchanged',
			name: modelName,
		})
	}

	// AnkiWeb sync
	const isChanged = modelsReport.some((model) => model.action !== 'unchanged')
	if (!dryRun && ankiWeb && (isChanged || syncToAnkiWebEvenIfUnchanged)) {
		await client.miscellaneous.sync()
	}

	return {
		ankiWeb,
		dryRun,
		duration: performance.now() - startTime,
		models: modelsReport,
	}
}

export function formatStyleResult(result: StyleResult, verbose = false): string {
	const lines: string[] = []

	const unchangedModels = result.models.filter((model) => model.action === 'unchanged')
	const updatedModels = result.models.filter((model) => model.action === 'updated')

	lines.push(
		`${result.dryRun ? 'Will' : 'Successfully'} update ${updatedModels.length} ${plur('model', updatedModels.length)} and left ${unchangedModels.length} ${plur('model', unchangedModels.length)} unchanged${result.dryRun ? '' : ` in ${prettyMilliseconds(result.duration)}`}.`,
	)

	if (verbose) {
		if (updatedModels.length > 0) {
			lines.push('', result.dryRun ? 'Models to update:' : 'Updated models:')
			for (const model of updatedModels) {
				lines.push(`  ${model.name}`)
			}
		}

		if (unchangedModels.length > 0) {
			lines.push('', result.dryRun ? 'Models unchanged:' : 'Unchanged models:')
			for (const model of unchangedModels) {
				lines.push(`  ${model.name}`)
			}
		}
	}

	return lines.join('\n')
}

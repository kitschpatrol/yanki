import { defaultCss } from '../model/constants'
import { yankiModelNames } from '../model/model'
import { updateModelStyle } from './anki-connect'
import { deepmerge } from 'deepmerge-ts'
import plur from 'plur'
import prettyMilliseconds from 'pretty-ms'
import type { PartialDeep } from 'type-fest'
import { YankiConnect, type YankiConnectOptions, defaultYankiConnectOptions } from 'yanki-connect'

export type StyleOptions = {
	ankiConnectOptions: YankiConnectOptions
	css: string
	dryRun: boolean
}

export const defaultStyleOptions: StyleOptions = {
	ankiConnectOptions: defaultYankiConnectOptions,
	css: defaultCss,
	dryRun: false,
}

export type StyleReport = {
	dryRun: boolean
	duration: number
	models: Array<{
		action: 'unchanged' | 'updated'
		name: string
	}>
}

export async function setStyle(options: PartialDeep<StyleOptions>): Promise<StyleReport> {
	const startTime = performance.now()

	// Defaults
	const { ankiConnectOptions, css, dryRun } = deepmerge(defaultStyleOptions, options ?? {})

	const client = new YankiConnect(ankiConnectOptions)

	const modelsReport: StyleReport['models'] = []

	for (const modelName of yankiModelNames) {
		const updated = await updateModelStyle(client, modelName, css, dryRun)

		modelsReport.push({
			action: updated ? 'updated' : 'unchanged',
			name: modelName,
		})
	}

	return {
		dryRun,
		duration: performance.now() - startTime,
		models: modelsReport,
	}
}

export function formatStyleReport(report: StyleReport, verbose = false): string {
	const lines: string[] = []

	const unchangedModels = report.models.filter((model) => model.action === 'unchanged')
	const updatedModels = report.models.filter((model) => model.action === 'updated')

	lines.push(
		`${report.dryRun ? 'Will' : 'Successfully'} update ${updatedModels.length} ${plur('model', updatedModels.length)} and left ${unchangedModels.length} ${plur('model', unchangedModels.length)} unchanged${report.dryRun ? '' : ` in ${prettyMilliseconds(report.duration)}`}`,
	)

	if (verbose) {
		if (updatedModels.length > 0) {
			lines.push('', report.dryRun ? 'Models to update:' : 'Updated models:')
			for (const model of updatedModels) {
				lines.push(`  ${model.name}`)
			}
		}

		if (unchangedModels.length > 0) {
			lines.push('', report.dryRun ? 'Models unchanged:' : 'Unchanged models:')
			for (const model of unchangedModels) {
				lines.push(`  ${model.name}`)
			}
		}
	}

	return lines.join('\n')
}

import { defaultCss } from '../model/constants'
import { yankiModelNames } from '../model/model'
import { updateModelStyle } from './anki-connect'
import { deepmerge } from 'deepmerge-ts'
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
	duration: number
	models: Array<{
		action: 'unchanged' | 'updated'
		name: string
	}>
}

export async function setStyle(options: Partial<StyleOptions>): Promise<StyleReport> {
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
		duration: performance.now() - startTime,
		models: modelsReport,
	}
}

import { yankiModelNames } from '../model/model'
import { CSS_DEFAULT_STYLE, SYNC_TO_ANKI_WEB_EVEN_IF_UNCHANGED } from '../shared/constants'
import { type GlobalOptions, defaultGlobalOptions } from '../shared/types'
import { getModelStyle, requestPermission, updateModelStyle } from '../utilities/anki-connect'
import { deepmerge } from 'deepmerge-ts'
import plur from 'plur'
import prettyMilliseconds from 'pretty-ms'
import type { PartialDeep, Simplify } from 'type-fest'
import { YankiConnect } from 'yanki-connect'

export type SetStyleOptions = {
	css: string
} & Pick<GlobalOptions, 'ankiConnectOptions' | 'ankiWeb' | 'dryRun'>

export const defaultSetStyleOptions: SetStyleOptions = {
	css: CSS_DEFAULT_STYLE,
	...defaultGlobalOptions,
}

export type SetStyleResult = Simplify<
	{
		duration: number
		models: Array<{
			action: 'unchanged' | 'updated'
			name: string
		}>
	} & Pick<GlobalOptions, 'ankiWeb' | 'dryRun'>
>

export type GetStyleOptions = Pick<GlobalOptions, 'ankiConnectOptions'>
export const defaultGetStyleOptions: GetStyleOptions = {
	...defaultGlobalOptions,
}

export async function getStyle(options: PartialDeep<GetStyleOptions>): Promise<string> {
	// Defaults
	const { ankiConnectOptions } = deepmerge(defaultSetStyleOptions, options ?? {}) as GetStyleOptions

	const client = new YankiConnect(ankiConnectOptions)
	const permissionStatus = await requestPermission(client)
	if (permissionStatus === 'ankiUnreachable') {
		throw new Error('Anki is unreachable. Is Anki running?')
	}

	// Create string set
	const cssSet = new Set<string>()

	for (const modelName of yankiModelNames) {
		const css = await getModelStyle(client, modelName)
		cssSet.add(css)
	}

	if (cssSet.size === 0) {
		throw new Error('No CSS found in any Yanki model.')
	}

	if (cssSet.size > 1) {
		throw new Error('Expected all Yanki models to have identical CSS.')
	}

	return [...cssSet][0]
}

export async function setStyle(options?: PartialDeep<SetStyleOptions>): Promise<SetStyleResult> {
	const startTime = performance.now()

	// Defaults
	const { ankiConnectOptions, ankiWeb, css, dryRun } = deepmerge(
		defaultSetStyleOptions,
		options ?? {},
	) as SetStyleOptions

	const client = new YankiConnect(ankiConnectOptions)

	const permissionStatus = await requestPermission(client)
	if (permissionStatus === 'ankiUnreachable') {
		throw new Error('Anki is unreachable. Is Anki running?')
	}

	const modelsReport: SetStyleResult['models'] = []

	for (const modelName of yankiModelNames) {
		const updated = await updateModelStyle(client, modelName, css, dryRun)

		modelsReport.push({
			action: updated ? 'updated' : 'unchanged',
			name: modelName,
		})
	}

	// AnkiWeb sync
	const isChanged = modelsReport.some((model) => model.action !== 'unchanged')
	if (!dryRun && ankiWeb && (isChanged || SYNC_TO_ANKI_WEB_EVEN_IF_UNCHANGED)) {
		await client.miscellaneous.sync()
	}

	return {
		ankiWeb,
		dryRun,
		duration: performance.now() - startTime,
		models: modelsReport,
	}
}

export function formatSetStyleResult(result: SetStyleResult, verbose = false): string {
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

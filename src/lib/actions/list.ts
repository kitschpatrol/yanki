import { type YankiNote } from '../model/note'
import { getFirstLineOfHtmlAsPlainText } from '../parse/rehype-utilities'
import { type GlobalOptions, defaultGlobalOptions } from '../shared/types'
import { getRemoteNotes, requestPermission } from '../utilities/anki-connect'
import { truncateWithEllipsis } from '../utilities/string'
import { deepmerge } from 'deepmerge-ts'
import type { PartialDeep } from 'type-fest'
import { YankiConnect } from 'yanki-connect'

export type ListOptions = Pick<GlobalOptions, 'ankiConnectOptions' | 'namespace'>

export const defaultListOptions: ListOptions = {
	...defaultGlobalOptions,
}

export type ListResult = {
	duration: number
	namespace: string
	notes: YankiNote[]
}

/**
 * Description List notes currently in Anki...
 * @param options
 * @returns
 */
export async function listNotes(options?: PartialDeep<ListOptions>): Promise<ListResult> {
	const startTime = performance.now()

	const { ankiConnectOptions, namespace } = deepmerge(
		defaultListOptions,
		options ?? {},
	) as ListOptions
	const client = new YankiConnect(ankiConnectOptions)

	const permissionStatus = await requestPermission(client)
	if (permissionStatus === 'ankiUnreachable') {
		throw new Error('Anki is unreachable. Is Anki running?')
	}

	const notes = await getRemoteNotes(client, namespace)

	return {
		duration: performance.now() - startTime,
		namespace,
		notes,
	}
}

export function formatListResult(result: ListResult): string {
	if (result.notes.length === 0) {
		return 'No notes found.'
	}

	const lines: string[] = []

	for (const note of result.notes) {
		const noteFrontText = truncateWithEllipsis(getFirstLineOfHtmlAsPlainText(note.fields.Front), 50)
		lines.push(`Note ID ${note.noteId} ${noteFrontText}`)
	}

	return lines.join('\n')
}

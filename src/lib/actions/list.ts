import { yankiDefaultNamespace } from '../model/constants'
import { type YankiNote } from '../model/note'
import { getFirstLineOfHtmlAsPlainText } from '../parse/rehype-utilities'
import { getRemoteNotes } from '../utilities/anki-connect'
import { truncateWithEllipsis } from '../utilities/string'
import { deepmerge } from 'deepmerge-ts'
import type { PartialDeep } from 'type-fest'
import { YankiConnect, type YankiConnectOptions, defaultYankiConnectOptions } from 'yanki-connect'

export type ListOptions = {
	ankiConnectOptions: YankiConnectOptions
	namespace: string
}

export const defaultListOptions: ListOptions = {
	ankiConnectOptions: defaultYankiConnectOptions,
	namespace: yankiDefaultNamespace,
}

export type ListReport = {
	duration: number
	namespace: string
	notes: YankiNote[]
}

/**
 * Description List notes...
 * @param options
 * @returns
 */
export async function listNotes(options?: PartialDeep<ListOptions>): Promise<ListReport> {
	const startTime = performance.now()

	const { ankiConnectOptions, namespace } = deepmerge(defaultListOptions, options ?? {})
	const client = new YankiConnect(ankiConnectOptions)
	const notes = await getRemoteNotes(client, namespace)

	return {
		duration: performance.now() - startTime,
		namespace,
		notes,
	}
}

export function formatListReport(report: ListReport): string {
	if (report.notes.length === 0) {
		return 'No notes found.'
	}

	const lines: string[] = []

	for (const note of report.notes) {
		const noteFrontText = truncateWithEllipsis(getFirstLineOfHtmlAsPlainText(note.fields.Front), 50)
		lines.push(`Note ID ${note.noteId} ${noteFrontText}`)
	}

	return lines.join('\n')
}

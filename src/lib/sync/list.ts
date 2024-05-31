import { type YankiNote, yankiDefaultNamespace } from '../model/yanki-note'
import { stripHtmlTags, truncateWithEllipsis } from '../utilities/string'
import { getRemoteNotes } from './anki-connect'
import { YankiConnect, type YankiConnectOptions } from 'yanki-connect'

export type ListOptions = {
	ankiConnectOptions?: YankiConnectOptions
	namespace?: string
}

export type ListReport = {
	duration: number
	namespace: string
	notes: YankiNote[]
}

/**
 * Description TODO
 * @param options
 * @returns
 */
export async function listNotes(options?: ListOptions): Promise<ListReport> {
	const startTime = performance.now()

	const { ankiConnectOptions, namespace = yankiDefaultNamespace } = options ?? {}
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
		return 'No notes found'
	}

	const lines: string[] = []

	for (const note of report.notes) {
		const firstLineOfFront = note.fields.Front.split('\n')[0]

		const noteFrontText = truncateWithEllipsis(stripHtmlTags(firstLineOfFront), 50)
		lines.push(`Note ID ${note.noteId} ${noteFrontText}`)
	}

	return lines.join('\n')
}

import { yankiDefaultNamespace } from '../model/constants'
import { type YankiNote } from '../model/note'
import { stripHtmlTags, truncateWithEllipsis } from '../utilities/string'
import { deleteNotes, deleteOrphanedDecks, getRemoteNotes } from './anki-connect'
import { deepmerge } from 'deepmerge-ts'
import plur from 'plur'
import prettyMilliseconds from 'pretty-ms'
import type { PartialDeep } from 'type-fest'
import { YankiConnect, type YankiConnectOptions, defaultYankiConnectOptions } from 'yanki-connect'

export const defaultCleanOptions: CleanOptions = {
	ankiConnectOptions: defaultYankiConnectOptions,
	dryRun: false,
	namespace: yankiDefaultNamespace,
}

export type CleanOptions = {
	ankiConnectOptions: YankiConnectOptions
	dryRun: boolean
	namespace: string
}

export type CleanReport = {
	decks: string[]
	deleted: YankiNote[]
	dryRun: boolean
	duration: number
	namespace: string
}

/**
 * Deletes all remote notes in Anki associated with the given namespace.
 *
 * Use with significant caution. Mostly useful for testing.
 *
 * @returns The IDs of the notes that were deleted
 * @param options
 * @throws
 */
export async function cleanNotes(options?: PartialDeep<CleanOptions>): Promise<CleanReport> {
	const startTime = performance.now()

	// Defaults
	const { ankiConnectOptions, dryRun, namespace } = deepmerge(defaultCleanOptions, options ?? {})

	const client = new YankiConnect(ankiConnectOptions)

	const remoteNotes = await getRemoteNotes(client, namespace)

	// Deletion pass
	await deleteNotes(client, remoteNotes, dryRun)
	const deletedDecks = await deleteOrphanedDecks(client, [], remoteNotes, dryRun)

	return {
		decks: deletedDecks,
		deleted: remoteNotes,
		dryRun,
		duration: performance.now() - startTime,
		namespace,
	}
}

export function formatCleanReport(report: CleanReport, verbose = false): string {
	const deckCount = report.decks.length
	const noteCount = report.deleted.length

	if (deckCount === 0 && noteCount === 0) {
		return 'Nothing to delete'
	}

	const lines: string[] = []

	lines.push(
		`${report.dryRun ? 'Would have' : 'Successfully'} deleted ${report.deleted.length} ${plur('note', noteCount)} and ${report.decks.length} ${plur('deck', deckCount)} from Anki${report.dryRun ? '' : ` in ${prettyMilliseconds(report.duration)}`}`,
	)

	if (verbose) {
		if (noteCount > 0) {
			lines.push('', report.dryRun ? 'Notes to delete:' : 'Deleted notes:')
			for (const note of report.deleted) {
				const firstLineOfFront = note.fields.Front.split('\n')[0]
				const noteFrontText = truncateWithEllipsis(stripHtmlTags(firstLineOfFront), 50)
				lines.push(`  Note ID ${note.noteId} ${noteFrontText}`)
			}
		}

		if (deckCount > 0) {
			lines.push('', report.dryRun ? 'Decks to delete:' : 'Deleted decks:')
			for (const deck of report.decks) {
				lines.push(`  ${deck}`)
			}
		}
	}

	return lines.join('\n')
}

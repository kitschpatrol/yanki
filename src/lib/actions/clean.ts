import { yankiDefaultNamespace, yankiSyncToAnkiWebEvenIfUnchanged } from '../model/constants'
import { type YankiNote } from '../model/note'
import { getFirstLineOfHtmlAsPlainText } from '../parse/rehype-utilities'
import { deleteNotes, deleteOrphanedDecks, getRemoteNotes } from '../utilities/anki-connect'
import { truncateWithEllipsis } from '../utilities/string'
import { deepmerge } from 'deepmerge-ts'
import plur from 'plur'
import prettyMilliseconds from 'pretty-ms'
import type { PartialDeep } from 'type-fest'
import { YankiConnect, type YankiConnectOptions, defaultYankiConnectOptions } from 'yanki-connect'

export const defaultCleanOptions: CleanOptions = {
	ankiConnectOptions: defaultYankiConnectOptions,
	ankiWeb: false,
	dryRun: false,
	namespace: yankiDefaultNamespace,
}

export type CleanOptions = {
	ankiConnectOptions: YankiConnectOptions
	/**
	 * Automatically sync any changes to AnkiWeb after Yanki has finished syncing
	 * locally. If false, only local Anki data is updated and you must manually
	 * invoke a sync to AnkiWeb. This is the equivalent of pushing the "sync"
	 * button in the Anki app.
	 */
	ankiWeb: boolean
	dryRun: boolean
	namespace: string
}

export type CleanReport = {
	ankiWeb: boolean
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
	const { ankiConnectOptions, ankiWeb, dryRun, namespace } = deepmerge(
		defaultCleanOptions,
		options ?? {},
	)

	const client = new YankiConnect(ankiConnectOptions)

	const remoteNotes = await getRemoteNotes(client, namespace)

	// Deletion pass
	await deleteNotes(client, remoteNotes, dryRun)
	const deletedDecks = await deleteOrphanedDecks(client, [], remoteNotes, dryRun)

	// AnkiWeb sync
	const isChanged = remoteNotes.length > 0 || deletedDecks.length > 0
	if (!dryRun && ankiWeb && (isChanged || yankiSyncToAnkiWebEvenIfUnchanged)) {
		await client.miscellaneous.sync()
	}

	return {
		ankiWeb,
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
		`${report.dryRun ? 'Will' : 'Successfully'} deleted ${report.deleted.length} ${plur('note', noteCount)} and ${report.decks.length} ${plur('deck', deckCount)} from Anki${report.dryRun ? '' : ` in ${prettyMilliseconds(report.duration)}`}.`,
	)

	if (verbose) {
		if (noteCount > 0) {
			lines.push('', report.dryRun ? 'Notes to delete:' : 'Deleted notes:')
			for (const note of report.deleted) {
				const noteFrontText = truncateWithEllipsis(
					getFirstLineOfHtmlAsPlainText(note.fields.Front),
					50,
				)
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

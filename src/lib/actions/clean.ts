import { type YankiNote } from '../model/note'
import { getFirstLineOfHtmlAsPlainText } from '../parse/rehype-utilities'
import { SYNC_TO_ANKI_WEB_EVEN_IF_UNCHANGED } from '../shared/constants'
import { type GlobalOptions, defaultGlobalOptions } from '../shared/types'
import {
	deleteNotes,
	deleteOrphanedDecks,
	deleteUnusedMedia,
	getRemoteNotes,
	requestPermission,
} from '../utilities/anki-connect'
import { validateAndSanitizeNamespace } from '../utilities/namespace'
import { truncateOnWordBoundary } from '../utilities/string'
import { deepmerge } from 'deepmerge-ts'
import plur from 'plur'
import prettyMilliseconds from 'pretty-ms'
import type { PartialDeep, Simplify } from 'type-fest'
import { YankiConnect } from 'yanki-connect'

export type CleanOptions = Pick<
	GlobalOptions,
	'ankiConnectOptions' | 'ankiWeb' | 'dryRun' | 'namespace'
>
export const defaultCleanOptions: CleanOptions = {
	...defaultGlobalOptions,
}

export type CleanResult = Simplify<
	{
		decks: string[]
		deleted: YankiNote[]

		duration: number
	} & Pick<GlobalOptions, 'ankiWeb' | 'dryRun' | 'namespace'>
>

/**
 * Deletes all remote notes in Anki associated with the given namespace.
 *
 * Use with significant caution. Mostly useful for testing.
 *
 * @returns The IDs of the notes that were deleted
 * @param options
 * @throws
 */
export async function cleanNotes(options?: PartialDeep<CleanOptions>): Promise<CleanResult> {
	const startTime = performance.now()

	// Defaults
	const { ankiConnectOptions, ankiWeb, dryRun, namespace } = deepmerge(
		defaultCleanOptions,
		options ?? {},
	) as CleanOptions

	const sanitizedNamespace = validateAndSanitizeNamespace(namespace, true)

	const client = new YankiConnect(ankiConnectOptions)

	const permissionStatus = await requestPermission(client)

	if (permissionStatus === 'ankiUnreachable') {
		throw new Error('Anki is unreachable. Is Anki running?')
	}

	const remoteNotes = await getRemoteNotes(client, sanitizedNamespace)

	// Deletion pass
	await deleteNotes(client, remoteNotes, dryRun)
	const deletedDecks = await deleteOrphanedDecks(client, [], remoteNotes, dryRun)

	// Media deletion pass
	await deleteUnusedMedia(client, [], sanitizedNamespace, dryRun)

	// AnkiWeb sync
	const isChanged = remoteNotes.length > 0 || deletedDecks.length > 0
	if (!dryRun && ankiWeb && (isChanged || SYNC_TO_ANKI_WEB_EVEN_IF_UNCHANGED)) {
		await client.miscellaneous.sync()
	}

	return {
		ankiWeb,
		decks: deletedDecks,
		deleted: remoteNotes,
		dryRun,
		duration: performance.now() - startTime,
		namespace: sanitizedNamespace,
	}
}

export function formatCleanResult(result: CleanResult, verbose = false): string {
	const deckCount = result.decks.length
	const noteCount = result.deleted.length

	if (deckCount === 0 && noteCount === 0) {
		return 'Nothing to delete'
	}

	const lines: string[] = []

	lines.push(
		`${result.dryRun ? 'Will' : 'Successfully'} deleted ${result.deleted.length} ${plur('note', noteCount)} and ${result.decks.length} ${plur('deck', deckCount)} from Anki${result.dryRun ? '' : ` in ${prettyMilliseconds(result.duration)}`}.`,
	)

	if (verbose) {
		if (noteCount > 0) {
			lines.push('', result.dryRun ? 'Notes to delete:' : 'Deleted notes:')
			for (const note of result.deleted) {
				const noteFrontText = truncateOnWordBoundary(
					getFirstLineOfHtmlAsPlainText(note.fields.Front),
					50,
				)
				lines.push(`  Note ID ${note.noteId} ${noteFrontText}`)
			}
		}

		if (deckCount > 0) {
			lines.push('', result.dryRun ? 'Decks to delete:' : 'Deleted decks:')
			for (const deck of result.decks) {
				lines.push(`  ${deck}`)
			}
		}
	}

	return lines.join('\n')
}

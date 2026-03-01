/* eslint-disable jsdoc/require-jsdoc */

import type { PartialDeep, Simplify } from 'type-fest'
import { deepmerge } from 'deepmerge-ts'
import plur from 'plur'
import prettyMilliseconds from 'pretty-ms'
import { YankiConnect } from 'yanki-connect'
import type { YankiNote } from '../model/note'
import type { GlobalOptions } from '../shared/types'
import { getFirstLineOfHtmlAsPlainText } from '../parse/rehype-utilities'
import { SYNC_TO_ANKI_WEB_EVEN_IF_UNCHANGED } from '../shared/constants'
import { defaultGlobalOptions } from '../shared/types'
import {
	deleteNotes,
	deleteOrphanedDecks,
	getRemoteNotes,
	reconcileMedia,
	requestPermission,
	syncToAnkiWeb,
} from '../utilities/anki-connect'
import { validateAndSanitizeNamespace } from '../utilities/namespace'
import { truncateOnWordBoundary } from '../utilities/string'

export type CleanOptions = Pick<
	GlobalOptions,
	'ankiConnectOptions' | 'ankiWeb' | 'dryRun' | 'namespace'
>
export const defaultCleanOptions: CleanOptions = {
	...defaultGlobalOptions,
}

export type CleanResult = Simplify<
	Pick<GlobalOptions, 'ankiWeb' | 'dryRun' | 'namespace'> & {
		deletedDecks: string[]
		deletedMedia: string[]
		deletedNotes: YankiNote[]
		duration: number
	}
>

/**
 * Deletes all remote notes in Anki associated with the given namespace.
 *
 * Use with significant caution. Mostly useful for testing.
 * @returns The IDs of the notes that were deleted
 * @throws {Error} If Anki is unreachable or another error occurs during deletion.
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

	// Media deletion pass (no fileAdapter needed — liveNotes is empty so re-upload is a no-op)
	const { deleted: deletedMedia } = await reconcileMedia(client, [], sanitizedNamespace, dryRun)

	// AnkiWeb sync
	const isChanged = remoteNotes.length > 0 || deletedDecks.length > 0
	// eslint-disable-next-line ts/no-unnecessary-condition
	if (!dryRun && ankiWeb && (isChanged || SYNC_TO_ANKI_WEB_EVEN_IF_UNCHANGED)) {
		await syncToAnkiWeb(client)
	}

	return {
		ankiWeb,
		deletedDecks,
		deletedMedia,
		deletedNotes: remoteNotes,
		dryRun,
		duration: performance.now() - startTime,
		namespace: sanitizedNamespace,
	}
}

export function formatCleanResult(result: CleanResult, verbose = false): string {
	const deckCount = result.deletedDecks.length
	const noteCount = result.deletedNotes.length
	const mediaCount = result.deletedMedia.length

	if (deckCount === 0 && noteCount === 0 && mediaCount === 0) {
		return 'Nothing to delete'
	}

	const lines: string[] = [
		`${result.dryRun ? 'Will' : 'Successfully'} deleted ${noteCount} ${plur('note', noteCount)}, ${deckCount} ${plur('deck', deckCount)}, and ${mediaCount} media ${plur('asset', mediaCount)} from Anki${result.dryRun ? '' : ` in ${prettyMilliseconds(result.duration)}`}.`,
	]

	if (verbose) {
		if (noteCount > 0) {
			lines.push('', result.dryRun ? 'Notes to delete:' : 'Deleted notes:')
			for (const note of result.deletedNotes) {
				const noteFrontText = truncateOnWordBoundary(
					getFirstLineOfHtmlAsPlainText(note.fields.Front),
					50,
				)
				lines.push(`  Note ID ${note.noteId} ${noteFrontText}`)
			}
		}

		if (deckCount > 0) {
			lines.push('', result.dryRun ? 'Decks to delete:' : 'Deleted decks:')
			for (const deck of result.deletedDecks) {
				lines.push(`  ${deck}`)
			}
		}

		if (mediaCount > 0) {
			lines.push('', result.dryRun ? 'Media assets to delete:' : 'Deleted media assets:')
			for (const asset of result.deletedMedia) {
				lines.push(`  ${asset}`)
			}
		}
	}

	return lines.join('\n')
}

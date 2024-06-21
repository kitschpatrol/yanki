import { setNoteIdInFrontmatter } from '../model/frontmatter'
import {
	type GlobalOptions,
	defaultGlobalOptions,
	getDefaultFileFunctions,
} from '../shared/options'
import { capitalize } from '../utilities/string'
import { loadLocalNotes } from './load-local-notes'
import { renameNotes } from './rename'
import {
	type SyncOptions,
	type SyncResult,
	type SyncedNote,
	defaultSyncOptions,
	syncNotes,
} from './sync'
import { deepmerge } from 'deepmerge-ts'
import plur from 'plur'
import prettyMilliseconds from 'pretty-ms'
import type { PartialDeep, Simplify } from 'type-fest'

export type SyncFilesOptions = Simplify<
	Pick<
		GlobalOptions,
		| 'fileFunctions'
		| 'manageFilenames'
		| 'maxFilenameLength'
		| 'namespace'
		| 'obsidianVault'
		| 'syncMediaAssets'
	> &
		SyncOptions
>

export const defaultSyncFilesOptions: SyncFilesOptions = {
	...defaultGlobalOptions,
	...defaultSyncOptions,
}

export type SyncedFile = Simplify<
	{
		filePath: string | undefined
		filePathOriginal: string | undefined
	} & SyncedNote
>

export type SyncFilesResult = Simplify<
	{
		synced: SyncedFile[]
	} & Omit<SyncResult, 'synced'>
>

/**
 * Sync a list of local yanki files to Anki.
 *
 * Wraps the syncNotes function to handle file I/O.
 *
 * Most importantly, it updates the note IDs in the frontmatter of the local
 * files.
 *
 * @param allLocalFilePaths Array of paths to the local markdown files
 * @returns The synced files (with new IDs where applicable), plus some stats
 * about the sync @throws
 */
export async function syncFiles(
	allLocalFilePaths: string[],
	options?: PartialDeep<SyncFilesOptions>,
): Promise<SyncFilesResult> {
	const startTime = performance.now()

	const {
		ankiConnectOptions,
		ankiWeb,
		dryRun,
		fileFunctions = getDefaultFileFunctions(),
		manageFilenames,
		maxFilenameLength,
		namespace,
		obsidianVault,
		syncMediaAssets,
	} = deepmerge(defaultSyncFilesOptions, options ?? {}) as SyncFilesOptions

	const localNotes = await loadLocalNotes(allLocalFilePaths, {
		fileFunctions,
		namespace,
		obsidianVault,
		syncMediaAssets,
	})

	const renamedLocalNotes = await renameNotes(localNotes, {
		dryRun,
		fileFunctions,
		manageFilenames,
		maxFilenameLength,
	})

	const allLocalNotes = renamedLocalNotes.map((note) => note.note)

	const { deletedDecks, synced } = await syncNotes(allLocalNotes, {
		ankiConnectOptions,
		ankiWeb,
		dryRun,
		namespace,
	})

	// Write IDs to the local files as necessary
	// Can't just get markdown from the note because there might be extra
	// frontmatter from e.g. obsidian, which is not captured in the YankiNote type
	// Cast it up to SyncedFile to get the filePaths
	const liveNotes = synced.filter((note) => note.action !== 'deleted') as SyncedFile[]

	for (const [index, loadedAndRenamedNote] of renamedLocalNotes.entries()) {
		const liveNote = liveNotes[index]

		if (
			(loadedAndRenamedNote.note.noteId === undefined ||
				loadedAndRenamedNote.note.noteId !== liveNote.note.noteId) &&
			liveNote.action !== 'ankiUnreachable'
		) {
			const updatedMarkdown = await setNoteIdInFrontmatter(
				loadedAndRenamedNote.markdown,
				liveNote.note.noteId,
			)
			await fileFunctions.writeFile(loadedAndRenamedNote.filePath, updatedMarkdown)
		}

		// Set file paths
		liveNote.filePath = loadedAndRenamedNote.filePath
		liveNote.filePathOriginal = loadedAndRenamedNote.filePathOriginal
	}

	// Add undefined file paths to deleted notes, since they only ever existed in Anki
	const deletedNotes: SyncedFile[] = synced
		.filter((note) => note.action === 'deleted')
		.map((note) => ({
			action: 'deleted',
			filePath: undefined,
			filePathOriginal: undefined,
			note: note.note,
		}))

	const syncedAndSorted = [...deletedNotes, ...liveNotes].sort((a, b) =>
		(a.filePath ?? '').localeCompare(b.filePath ?? ''),
	)

	return {
		ankiWeb,
		deletedDecks,
		dryRun,
		duration: performance.now() - startTime,
		namespace,
		synced: syncedAndSorted,
	}
}

export function formatSyncFilesResult(result: SyncFilesResult, verbose = false): string {
	const lines: string[] = []
	const { synced } = result

	// Aggregate the counts of each action:
	const actionCounts = synced.reduce<Record<string, number>>((acc, note) => {
		acc[note.action] = (acc[note.action] || 0) + 1
		return acc
	}, {})

	const totalSynced = synced.filter((note) => note.action !== 'deleted').length
	const totalRenamed = synced.filter((note) => note.filePath !== note.filePathOriginal).length
	const ankiUnreachable = actionCounts.ankiUnreachable > 0

	lines.push(
		`${result.dryRun ? 'Will sync' : ankiUnreachable ? 'Failed to sync' : 'Successfully synced'} synced ${totalSynced} ${plur('note', totalSynced)} to Anki${result.dryRun ? '' : ` in ${prettyMilliseconds(result.duration)}`}.`,
	)

	if (verbose) {
		lines.push('', result.dryRun ? 'Sync Plan Summary:' : 'Sync Summary:')
		for (const [action, count] of Object.entries(actionCounts)) {
			lines.push(`  ${capitalize(action)}: ${count}`)
		}

		if (totalRenamed > 0) {
			lines.push('', `Local notes renamed: ${totalRenamed}`)
		}

		if (result.deletedDecks.length > 0) {
			lines.push('', `Decks pruned: ${result.deletedDecks.length}`)
		}

		lines.push('', result.dryRun ? 'Sync Plan Details:' : 'Sync Details:')
		for (const { action, filePath, note } of synced) {
			if (filePath === undefined) {
				lines.push(`  Note ID ${note.noteId} ${capitalize(action)} (From Anki)`)
			} else {
				lines.push(`  Note ID ${note.noteId} ${capitalize(action)} ${filePath}`)
			}
		}
	}

	return lines.join('\n')
}

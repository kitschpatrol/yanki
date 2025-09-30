/* eslint-disable jsdoc/require-jsdoc */

import type { PartialDeep, Simplify } from 'type-fest'
import { deepmerge } from 'deepmerge-ts'
import plur from 'plur'
import prettyMilliseconds from 'pretty-ms'
import type { GlobalOptions } from '../shared/types'
import type { SyncedNote, SyncNotesOptions, SyncNotesResult } from './sync-notes'
import { setNoteIdInFrontmatter } from '../model/frontmatter'
import {
	defaultGlobalOptions,
	getDefaultFetchAdapter,
	getDefaultFileAdapter,
} from '../shared/types'
import { validateAndSanitizeNamespace } from '../utilities/namespace'
import { normalize } from '../utilities/path'
import { capitalize } from '../utilities/string'
import { loadLocalNotes } from './load-local-notes'
import { renameNotes } from './rename'
import { defaultSyncNotesOptions, syncNotes } from './sync-notes'

export type SyncFilesOptions = Simplify<
	Pick<
		GlobalOptions,
		| 'allFilePaths'
		| 'basePath'
		| 'fetchAdapter'
		| 'fileAdapter'
		| 'manageFilenames'
		| 'maxFilenameLength'
		| 'obsidianVault'
		| 'strictLineBreaks'
		| 'syncMediaAssets'
	> &
		SyncNotesOptions
>

export const defaultSyncFilesOptions: SyncFilesOptions = {
	...defaultGlobalOptions,
	...defaultSyncNotesOptions,
}

type SyncedFile = Simplify<
	SyncedNote & {
		filePath: string | undefined
		filePathOriginal: string | undefined
	}
>

export type SyncFilesResult = Simplify<
	Omit<SyncNotesResult, 'synced'> & {
		synced: SyncedFile[]
	}
>

/**
 * Sync a list of local yanki files to Anki.
 *
 * Wraps the syncNotes function to handle file I/O.
 *
 * Most importantly, it updates the note IDs in the frontmatter of the local
 * files.
 * @param allLocalFilePaths Array of paths to the local markdown files
 * @returns The synced files (with new IDs where applicable), plus some stats
 * about the sync
 * @throws {Error} If syncing fails or file operations encounter an error.
 */
export async function syncFiles(
	allLocalFilePaths: string[],
	options?: PartialDeep<SyncFilesOptions>,
): Promise<SyncFilesResult> {
	const startTime = performance.now()

	const {
		allFilePaths: allFilePathsRaw, // To be normalized
		ankiConnectOptions,
		ankiWeb,
		basePath: basePathRaw, // To be normalized
		checkDatabase,
		dryRun,
		fetchAdapter = getDefaultFetchAdapter(),
		fileAdapter = await getDefaultFileAdapter(),
		manageFilenames,
		maxFilenameLength,
		namespace: namespaceRaw, // To be validated and sanitized
		obsidianVault,
		strictLineBreaks,
		strictMatching,
		syncMediaAssets,
	} = deepmerge(defaultSyncFilesOptions, options ?? {}) as SyncFilesOptions

	// Path normalization
	const allLocalFilePathsNormalized = allLocalFilePaths.map((file) => normalize(file))
	const basePath = basePathRaw === undefined ? undefined : normalize(basePathRaw)
	const allFilePaths = allFilePathsRaw.map((file) => normalize(file))

	// Technically redundant with validation in loadLocalNotes...
	const namespace = validateAndSanitizeNamespace(namespaceRaw)

	const localNotes = await loadLocalNotes(allLocalFilePathsNormalized, {
		allFilePaths,
		basePath,
		fetchAdapter,
		fileAdapter,
		namespace,
		obsidianVault,
		strictLineBreaks,
		syncMediaAssets,
	})

	const renamedLocalNotes = await renameNotes(localNotes, {
		dryRun,
		fileAdapter,
		manageFilenames,
		maxFilenameLength,
	})

	// In Obsidian, note contents might change if the file name changes
	// because intra-note links might have been updates, so we have to check
	// for this and reload the notes
	if (obsidianVault !== undefined) {
		// Check to see if any notes were renamed
		const notesWereRenamed = renamedLocalNotes.some(
			(renamedNote) => renamedNote.filePath !== renamedNote.filePathOriginal,
		)

		// Reload notes if necessary to reconcile any changes to intra-note link paths
		if (notesWereRenamed) {
			const allLocalFilePathsReloaded = renamedLocalNotes.map((note) => note.filePath)

			// Update note names in allFilePaths so links resolve correctly
			const allFilePathsReloaded = allFilePaths.map((filePath) => {
				const renamedNote = renamedLocalNotes.find(
					(renamedNote) => renamedNote.filePathOriginal === filePath,
				)
				return renamedNote ? renamedNote.filePath : filePath
			})

			const reloadedLocalNotes = await loadLocalNotes(allLocalFilePathsReloaded, {
				allFilePaths: allFilePathsReloaded,
				basePath,
				fetchAdapter,
				fileAdapter,
				namespace,
				obsidianVault,
				strictLineBreaks,
				syncMediaAssets,
			})

			// Replace the renamed notes with the reloaded notes
			for (const [index, renamedNote] of renamedLocalNotes.entries()) {
				renamedNote.note = reloadedLocalNotes[index].note
			}
		}
	}

	const allLocalNotes = renamedLocalNotes.map((note) => note.note)

	const { deletedDecks, deletedMedia, fixedDatabase, synced } = await syncNotes(allLocalNotes, {
		ankiConnectOptions,
		ankiWeb,
		checkDatabase,
		dryRun,
		namespace,
		strictMatching,
	})

	// Write Anki note IDs to the local files as necessary
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

			if (!dryRun) {
				await fileAdapter.writeFile(loadedAndRenamedNote.filePath, updatedMarkdown)
			}
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
		deletedMedia,
		dryRun,
		duration: performance.now() - startTime,
		fixedDatabase,
		namespace,
		synced: syncedAndSorted,
	}
}

export function formatSyncFilesResult(result: SyncFilesResult, verbose = false): string {
	const lines: string[] = []
	const { synced } = result

	// Aggregate the counts of each action:
	// eslint-disable-next-line unicorn/no-array-reduce
	const actionCounts = synced.reduce<Record<string, number>>((acc, note) => {
		acc[note.action] = (acc[note.action] || 0) + 1
		return acc
	}, {})

	const totalSynced = synced.filter((note) => note.action !== 'deleted').length
	const totalRenamed = synced.filter((note) => note.filePath !== note.filePathOriginal).length
	const ankiUnreachable = actionCounts.ankiUnreachable > 0

	lines.push(
		`${result.dryRun ? 'Will sync' : ankiUnreachable ? 'Failed to sync' : 'Successfully synced'} ${totalSynced} ${plur('note', totalSynced)} to Anki${result.dryRun ? '' : ` in ${prettyMilliseconds(result.duration)}`}.`,
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

		if (result.deletedMedia.length > 0) {
			lines.push('', `Media assets deleted: ${result.deletedMedia.length}`)
		}

		// Will never apply to a dry run since the Anki database is not mutated, and
		// therefore no corruption is possible
		if (!result.dryRun) {
			lines.push('', `Database automatically fixed: ${result.fixedDatabase ? 'Yes' : 'No'}`)
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

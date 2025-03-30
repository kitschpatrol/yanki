/* eslint-disable ts/no-unnecessary-condition */
/* eslint-disable jsdoc/require-jsdoc */

import type { Simplify } from 'type-fest'
import { deepmerge } from 'deepmerge-ts'
import path from 'path-browserify-esm'
import type { GlobalOptions } from '../shared/types'
import type { LoadOptions, LocalNote } from './load-local-notes'
import {
	defaultGlobalOptions,
	getDefaultFetchAdapter,
	getDefaultFileAdapter,
} from '../shared/types'
import {
	auditUniqueFilePath,
	getSafeTitleForNote,
	getTemporarilyUniqueFilePath,
	getUniqueFilePath,
} from '../utilities/filenames'
import { validateAndSanitizeNamespace } from '../utilities/namespace'
import { normalize } from '../utilities/path'
import { loadLocalNotes } from './load-local-notes'

type RenameNotesOptions = Pick<
	GlobalOptions,
	| 'dryRun'
	| 'fileAdapter'
	| 'manageFilenames'
	| 'maxFilenameLength'
	/** Included because this can technically change the content of the "first line" of a card */
	| 'strictLineBreaks'
>

const defaultRenameNotesOptions: RenameNotesOptions = {
	...defaultGlobalOptions,
}

export async function renameNotes(
	notes: LocalNote[],
	options: Partial<RenameNotesOptions>,
): Promise<LocalNote[]> {
	const {
		dryRun,
		fileAdapter = await getDefaultFileAdapter(),
		manageFilenames,
		maxFilenameLength,
	} = deepmerge(defaultRenameNotesOptions, options ?? {})

	if (manageFilenames !== 'off') {
		// Update the file paths in the live files...

		const newFilePaths: string[] = []

		for (const noteToRename of notes) {
			const { filePath: filePathOriginal, note } = noteToRename

			if (filePathOriginal === undefined) {
				throw new Error('File path is undefined')
			}

			const newFilename = getSafeTitleForNote(note, manageFilenames, maxFilenameLength)
			const newFilePath = path.join(
				path.dirname(filePathOriginal),
				`${newFilename}${path.extname(filePathOriginal)}`,
			)

			const newUniqueFilePath = getUniqueFilePath(newFilePath, newFilePaths)

			noteToRename.filePath = newUniqueFilePath
			newFilePaths.push(newUniqueFilePath.toLowerCase())
		}

		// Clean up singular incremented paths
		for (const noteToRename of notes) {
			const { filePath } = noteToRename
			if (filePath === undefined) {
				throw new Error('File path is undefined')
			}

			noteToRename.filePath = auditUniqueFilePath(filePath, newFilePaths)
		}

		// Execute rename plan from liveFiles filePath fields, checking for possible collisions with the existing "old" paths.
		// This is circuitous, but it means we don't need to implement additional file functions.
		const intermediateRenamePlan = new Map<string, string>()

		for (const noteToRename of notes) {
			const { filePath, filePathOriginal } = noteToRename
			if (filePathOriginal === undefined) {
				throw new Error('Original file path is undefined.')
			}

			if (filePath === undefined) {
				throw new Error('File path is undefined.')
			}

			if (filePath === filePathOriginal) {
				// No change
				continue
			}

			// Check for old path collisions, excluding self
			let safeNewFilePath = filePath
			if (
				notes.some(
					({ filePath: someFilePath, filePathOriginal: someFilePathOriginal }) =>
						someFilePath !== filePath &&
						someFilePathOriginal?.toLowerCase() === filePath.toLowerCase(),
				)
			) {
				safeNewFilePath = getTemporarilyUniqueFilePath(filePath)

				intermediateRenamePlan.set(safeNewFilePath, filePath)
			}

			if (!dryRun) {
				await fileAdapter.rename(filePathOriginal, safeNewFilePath)
			}
		}

		// One more pass to fix the intermediates
		for (const [temporarilyUniquePath, newPath] of intermediateRenamePlan) {
			if (!dryRun) {
				await fileAdapter.rename(temporarilyUniquePath, newPath)
			}
		}
	}

	notes.sort((a, b) => a.filePath.localeCompare(b.filePath))

	return notes
}

export type RenameFilesResult = {
	dryRun: boolean
	notes: LocalNote[]
}

export type RenameFilesOptions = Simplify<LoadOptions & RenameNotesOptions>

export const defaultRenameFilesOptions: RenameFilesOptions = {
	...defaultGlobalOptions,
}

/**
 * Currently used for testing and by `yanki-obsidian`.
 */
export async function renameFiles(
	allLocalFilePaths: string[],
	options: Partial<RenameFilesOptions>,
): Promise<RenameFilesResult> {
	const {
		allFilePaths: allFilePathsRaw, // To be normalized
		basePath: basePathRaw, // To be normalized
		dryRun,
		fetchAdapter = getDefaultFetchAdapter(),
		fileAdapter = await getDefaultFileAdapter(),
		manageFilenames,
		maxFilenameLength,
		namespace: namespaceRaw, // To be validated and sanitized
		obsidianVault,
		strictLineBreaks,
		syncMediaAssets,
	} = deepmerge(defaultRenameFilesOptions, options ?? {})

	// Path normalization
	const allLocalFilePathsNormalized = allLocalFilePaths.map((file) => normalize(file))
	const basePath = basePathRaw === undefined ? undefined : normalize(basePathRaw)
	const allFilePaths = allFilePathsRaw.map((file) => normalize(file))

	// Technically redundant with validation in loadLocalNotes...
	const namespace = validateAndSanitizeNamespace(namespaceRaw)

	const notes = await loadLocalNotes(allLocalFilePathsNormalized, {
		allFilePaths,
		basePath,
		fetchAdapter,
		fileAdapter,
		namespace,
		obsidianVault,
		strictLineBreaks,
		syncMediaAssets,
	})

	const renamedNotes = await renameNotes(notes, {
		dryRun,
		fileAdapter,
		manageFilenames,
		maxFilenameLength,
	})

	return {
		dryRun,
		notes: renamedNotes,
	}
}

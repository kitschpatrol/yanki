import {
	type GlobalOptions,
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
import { type LoadOptions, type LocalNote, loadLocalNotes } from './load-local-notes'
import { deepmerge } from 'deepmerge-ts'
import path from 'path-browserify-esm'
import { type Simplify } from 'type-fest'

export type RenameNotesOptions = Pick<
	GlobalOptions,
	'dryRun' | 'fileAdapter' | 'manageFilenames' | 'maxFilenameLength'
>

export const defaultRenameNotesOptions: RenameNotesOptions = {
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

export async function renameFiles(
	allLocalFilePaths: string[],
	options: Partial<RenameFilesOptions>,
): Promise<RenameFilesResult> {
	const {
		basePath,
		dryRun,
		fetchAdapter = getDefaultFetchAdapter(),
		fileAdapter = await getDefaultFileAdapter(),
		manageFilenames,
		maxFilenameLength,
		namespace,
		obsidianVault,
		syncMediaAssets,
	} = deepmerge(defaultRenameFilesOptions, options ?? {})

	// Technically redundant with validation in loadLocalNotes...
	const sanitizedNamespace = validateAndSanitizeNamespace(namespace)

	const notes = await loadLocalNotes(allLocalFilePaths, {
		basePath,
		fetchAdapter,
		fileAdapter,
		namespace: sanitizedNamespace,
		obsidianVault,
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

import { yankiDefaultNamespace } from '../model/constants'
import { type YankiNote } from '../model/note'
import { getNoteFromMarkdown } from '../parse/parse'
import { validateFileFunctions } from '../utilities/file'
import {
	auditUniqueFilePath,
	getSafeTitleForNote,
	getTemporarilyUniqueFilePath,
	getUniqueFilePath,
} from '../utilities/filenames'
import { environment } from '../utilities/platform'
import { deepmerge } from 'deepmerge-ts'
import path from 'path-browserify-esm'

export type RenameFilesReport = {
	dryRun: boolean
	notes: Array<{
		filePath: string
		filePathOriginal: string
		markdown: string // Useful later for updating the note ID in the frontmatter
		note: YankiNote
	}>
}

export type FilenameMode = 'prompt' | 'response'
export type RenameFilesOptions = {
	dryRun: boolean
	filenameMode: FilenameMode
	manageFilenames: boolean
	maxFilenameLength: number
	namespace: string
	obsidianVault: string | undefined
}

export const defaultRenameFilesOptions: RenameFilesOptions = {
	dryRun: false,
	filenameMode: 'prompt',
	manageFilenames: false,
	maxFilenameLength: 60,
	namespace: yankiDefaultNamespace,
	obsidianVault: undefined,
}

/**
 * Also loads the notes from markdown and sets deck names...
 * @param allLocalFilePaths
 * @param options
 * @param readFile
 * @param writeFile
 * @param rename
 */
export async function renameFiles(
	allLocalFilePaths: string[],
	options: Partial<RenameFilesOptions>,
	readFile?: (filePath: string) => Promise<string>,
	writeFile?: (filePath: string, data: string) => Promise<void>, // Not used, yet
	rename?: (oldPath: string, newPath: string) => Promise<void>,
): Promise<RenameFilesReport> {
	const { readFile: readFileValidated, rename: renameValidated } = await validateFileFunctions(
		readFile,
		writeFile,
		rename,
	)

	const resolvedOptions = deepmerge(defaultRenameFilesOptions, options ?? {})
	const { dryRun, filenameMode, manageFilenames, maxFilenameLength, namespace, obsidianVault } =
		resolvedOptions

	allLocalFilePaths.sort((a, b) => a.localeCompare(b))

	// Use file paths as deck names
	const deckNamesFromFilePaths = getDeckNamesFromFilePaths(allLocalFilePaths)

	const notes: Array<RenameFilesReport['notes'][number]> = []

	for (const [index, filePath] of allLocalFilePaths.entries()) {
		const markdown = await readFileValidated(filePath)
		const note = await getNoteFromMarkdown(markdown, { namespace, obsidianVault })
		if (note.deckName === '') {
			note.deckName = deckNamesFromFilePaths[index]
		}

		notes.push({
			filePath,
			filePathOriginal: filePath,
			markdown,
			note,
		})
	}

	// Manage filenames
	if (manageFilenames) {
		// Update the file paths in the live files...

		const newFilePaths: string[] = []

		for (const noteToRename of notes) {
			const { filePathOriginal, note } = noteToRename

			if (filePathOriginal === undefined) {
				throw new Error('File path is undefined')
			}

			const newFilename = getSafeTitleForNote(note, filenameMode, maxFilenameLength)
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
				await renameValidated(filePathOriginal, safeNewFilePath)
			}
		}

		// One more pass to fix the intermediates
		for (const [temporarilyUniquePath, newPath] of intermediateRenamePlan) {
			if (!dryRun) {
				await renameValidated(temporarilyUniquePath, newPath)
			}
		}
	}

	notes.sort((a, b) => a.filePath.localeCompare(b.filePath))

	return {
		dryRun,
		notes,
	}
}

/**
 * Helper function to infer deck names from file paths if `deckName` not defined in the note's frontmatter.
 *
 * `deckName` will always override the inferred deck name.
 *
 * Depends on the context of _all_ file paths passed to `syncNoteFiles`.
 *
 * Example of paths -> deck names with `common-root`:
 * /base/foo/note.md -> foo
 * /base/foo/baz/note.md -> foo::baz
 *
 * Example of paths -> deck names with `common-root`:
 * /base/foo/note.md -> foo
 * /base/foo/note.md -> foo
 *
 * Example of paths -> deck names with `common-parent`:
 * /base/foo/note.md -> base::foo
 * /base/foo/baz/note.md -> base::foo::baz
 *
 * Example of paths -> deck names with `common-parent`:
 * /base/foo/note.md -> foo
 * /base/foo/note.md -> foo
 *
 * @param absoluteFilePaths Absolute paths to all markdown Anki note files. (Ensures proper resolution if path module is polyfilled.)
 * @param prune If true, deck names are not allowed to "jump" over empty directories, even if there are other note files somewhere up the hierarchy
 * @returns array of ::-delimited deck paths
 */
export function getDeckNamesFromFilePaths(
	absoluteFilePaths: string[],
	mode: 'common-parent' | 'common-root' = 'common-root',
) {
	if (environment === 'node') {
		path.setCWD(process.cwd())
	}

	const filePathSegments = absoluteFilePaths.map((filePath) =>
		path.dirname(path.resolve(filePath)).split(path.sep),
	)

	// Trim to the shortest common path
	const commonPathSegments = filePathSegments.reduce((acc, pathSegments) => {
		const commonPath = acc.filter((segment, index) => segment === pathSegments[index])
		return commonPath
	})

	// Does the root segment have a file in it?
	const lastSegmentHasFile = filePathSegments.some(
		(pathSegments) => pathSegments.at(-1) === commonPathSegments.at(-1),
	)

	// Kinda tricky
	const offset =
		mode === 'common-parent' ? (lastSegmentHasFile ? 1 : 1) : lastSegmentHasFile ? 1 : 0

	const deckNamesWithShortestCommonPath = filePathSegments.map((pathSegments) =>
		pathSegments.slice(commonPathSegments.length - offset).join('::'),
	)

	return deckNamesWithShortestCommonPath
}

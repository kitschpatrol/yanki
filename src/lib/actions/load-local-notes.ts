import type { YankiNote } from '../model/note'
import { getNoteFromMarkdown } from '../parse/parse'
import {
	type GlobalOptions,
	defaultGlobalOptions,
	getDefaultFetchAdapter,
	getDefaultFileAdapter,
} from '../shared/types'
import { resolveWithBasePath } from '../utilities/file'
import { validateAndSanitizeNamespace } from '../utilities/namespace'
import { deepmerge } from 'deepmerge-ts'
import path from 'path-browserify-esm'

export type LoadOptions = Pick<
	GlobalOptions,
	'basePath' | 'fetchAdapter' | 'fileAdapter' | 'namespace' | 'obsidianVault' | 'syncMediaAssets'
>

export const defaultLoadOptions: LoadOptions = {
	...defaultGlobalOptions,
}

export type LocalNote = {
	filePath: string
	filePathOriginal: string
	markdown: string
	note: YankiNote
}

export async function loadLocalNotes(
	allLocalFilePaths: string[],
	options: Partial<LoadOptions>,
): Promise<LocalNote[]> {
	const {
		basePath,
		fetchAdapter = getDefaultFetchAdapter(),
		fileAdapter = await getDefaultFileAdapter(),
		namespace,
		obsidianVault,
		syncMediaAssets,
	} = deepmerge(defaultLoadOptions, options ?? {})

	const sanitizedNamespace = validateAndSanitizeNamespace(namespace)

	allLocalFilePaths.sort((a, b) => a.localeCompare(b))

	// Use file paths as deck names
	// TODO pass base path?
	const deckNamesFromFilePaths = getDeckNamesFromFilePaths(allLocalFilePaths, { basePath })

	const localNotes: LocalNote[] = []

	for (const [index, filePath] of allLocalFilePaths.entries()) {
		const markdown = await fileAdapter.readFile(filePath)

		const note = await getNoteFromMarkdown(markdown, {
			basePath,
			cwd: path.dirname(filePath),
			fetchAdapter,
			fileAdapter,
			namespace: sanitizedNamespace,
			namespaceValidationAndSanitization: false, // Optimization
			obsidianVault,
			syncMediaAssets,
		})

		if (note.deckName === '') {
			note.deckName = deckNamesFromFilePaths[index]
		}

		localNotes.push({
			filePath,
			filePathOriginal: filePath,
			markdown,
			note,
		})
	}

	return localNotes
}

type DeckNamesFromFilePathsOptions = {
	mode: 'common-parent' | 'common-root'
} & Pick<GlobalOptions, 'basePath' | 'cwd'>

const defaultDeckNamesFromFilePathsOptions: DeckNamesFromFilePathsOptions = {
	...defaultGlobalOptions,
	mode: 'common-root',
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
 * @returns array of ::-delimited deck paths
 */
function getDeckNamesFromFilePaths(
	absoluteFilePaths: string[],
	options: Partial<DeckNamesFromFilePathsOptions>,
) {
	const { basePath, cwd, mode } = deepmerge(defaultDeckNamesFromFilePathsOptions, options ?? {})

	const filePathSegments = absoluteFilePaths.map((filePath) =>
		path.dirname(resolveWithBasePath(filePath, { basePath, cwd })).split(path.sep),
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

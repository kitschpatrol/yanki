/* eslint-disable jsdoc/require-jsdoc */

// TODO move this into its own package?

import { deepmerge } from 'deepmerge-ts'
import path from 'path-browserify-esm'
import * as pathExtras from './path'
import {
	fileUrlToPath,
	getSrcType,
	safeDecodeURI,
	safeDecodeURIComponent,
	safeParseUrl,
} from './url'

const MD_EXTENSION_REGEX = /\.md$/v

type ResolveLinkType =
	// Via a `![[link]]` or `![alt](link)` syntax
	| 'embed'
	// Via a `[[link]]` or `[text](link)` syntax
	| 'link'

type ResolveLinkOptions = {
	/**
	 * Array of all absolute file paths to consider when resolving wiki-style
	 * named links.
	 */
	allFilePaths?: string[] | undefined
	/**
	 * How to treat file paths without a leading `/`, `./`, or `../` Useful in
	 * Obsidian vaults where bare paths can be relative to the vault root TODO
	 * evaluate if this makes sense
	 */
	// barePathsAreRelativeTo: 'base' | 'cwd'
	/**
	 * Custom base path to resolve "absolute" paths against. Useful in Obsidian
	 * vaults where "/" is the root of the vault, not the root of the filesystem.
	 * Must be an absolute directory path.
	 */
	basePath?: string | undefined
	/**
	 * Turns a file path into a URL with a specific protocol. Useful for
	 * converting markdown links to Obsidian vault links.
	 */
	convertFilePathsToProtocol?: 'file' | 'none' | 'obsidian'
	/**
	 * Current working directory, used to resolve relative paths. Set to the
	 * absolute path of the file being processed.
	 */
	cwd: string
	/**
	 * Name of Obsidian vault, used in Obsidian protocol URL creation.
	 */
	obsidianVaultName?: string | undefined
	/**
	 * Whether we're dealing with a link (to be `<a>`-tagged) or an embed (to be
	 * `<img>`-tagged). Affects how the resolved path is treated.
	 */
	type: ResolveLinkType
}

const defaultResolveLinkOptions: Partial<ResolveLinkOptions> = {
	allFilePaths: [],
	// TODO consider...
	// barePathsAreRelativeTo: 'cwd',
	basePath: undefined,
	convertFilePathsToProtocol: 'none',
	obsidianVaultName: undefined,
}

/**
 * Resolve a file path, URL, or wiki-style named links to an absolute path.
 *
 * Warning: Wiki name link resolution is CASE INSENSITIVE, like in Obsidian,
 * though the case of the matching file will be preserved in the returned path.
 *
 * @param filePathOrUrl May be one of:
 *
 *   - Wiki named link
 *   - Relative file path
 *   - Bare file path
 *   - Absolute file path
 *   - HTTP protocol URL string
 *   - File protocol URL string
 *   - Obsidian protocol URL string (All file paths can be Windows or POSIX, with or
 *       without URI encoding, with or without funky Obsidian-style
 *       post-extension block and heading anchor additions.)
 *
 *
 * @returns Resolved absolute path or URL One of:
 *
 *   - Resolved absolute POSIX-style paths
 *   - Removes any Obsidian-style heading and block anchors, unless the anchor
 *       characters are a literal part of a matched file's name (`?` is always
 *       treated as a literal file name character in local paths)
 *   - Not URI-encoded
 *   - Retains original case
 *   - HTTP protocol URL
 *   - Obsidian protocol vault URL (Optionally, this will include file query
 *       parameters)
 */
export function resolveLink(filePathOrUrl: string, options: ResolveLinkOptions): string {
	// Defaults
	const { allFilePaths, basePath, convertFilePathsToProtocol, cwd, obsidianVaultName, type } =
		// eslint-disable-next-line ts/no-unnecessary-condition
		deepmerge(defaultResolveLinkOptions, options ?? {}) as ResolveLinkOptions

	// Option validation...
	if (convertFilePathsToProtocol === 'obsidian' && obsidianVaultName === undefined) {
		console.warn(`convertFilePathsToProtocol is 'obsidian', but no obsidianVaultName provided`)
	}

	// Wiki-style names and file URLs resolve to file paths that are run through
	// the loop again as localFilePaths, which never loop again themselves
	let currentPathOrUrl = filePathOrUrl

	for (;;) {
		const decodedUrl = safeDecodeURI(currentPathOrUrl) ?? currentPathOrUrl

		const sourceType = getSrcType(decodedUrl)

		if (sourceType === 'localFileName') {
			const resolvedNameLink = resolveNameLink(
				pathExtras.normalize(decodedUrl),
				cwd,
				allFilePaths ?? [],
			)

			// Fall back to base path resolution if there's no match
			const resolvedUrl =
				resolvedNameLink ??
				pathExtras.resolveWithBasePath(decodedUrl, {
					basePath,
					cwd,
				})

			// Run it through again as a relative localFilePath

			// Prevent an infinite loop
			if (getSrcType(resolvedUrl) === 'localFilePath') {
				currentPathOrUrl = resolvedUrl
				continue
			}

			console.warn(
				`Failed to convert local file wiki-style name to path: ${currentPathOrUrl} --> ${resolvedUrl}`,
			)
			return resolvedUrl
		}

		if (sourceType === 'localFileUrl') {
			// Convert file:// url to path (file:// paths are already always absolute)
			// Anki can't open them
			const resolvedUrl = pathExtras.normalize(fileUrlToPath(currentPathOrUrl))

			// Run it through again as a localFilePath

			// Prevent an infinite loop
			if (getSrcType(resolvedUrl) === 'localFilePath') {
				currentPathOrUrl = resolvedUrl
				continue
			}

			console.warn(`Failed to convert file URL to path: ${currentPathOrUrl} --> ${resolvedUrl}`)
			return resolvedUrl
		}

		switch (sourceType) {
			case 'localFilePath': {
				return resolveLocalFilePath(decodedUrl, {
					allFilePaths,
					basePath,
					convertFilePathsToProtocol,
					cwd,
					obsidianVaultName,
					type,
				})
			}

			case 'obsidianVaultUrl': {
				// Do nothing
				return currentPathOrUrl
			}

			case 'remoteHttpUrl': {
				// Do nothing
				return currentPathOrUrl
			}

			case 'unsupportedProtocolUrl': {
				console.warn(`Unsupported URL protocol: ${currentPathOrUrl}`)
				return currentPathOrUrl
			}
		}
	}
}

/**
 * Resolve a decoded local file path to an absolute path or protocol URL.
 * Extracted from `resolveLink` for the benefit of readability (and the
 * `max-depth` lint rule).
 */
function resolveLocalFilePath(decodedUrl: string, options: ResolveLinkOptions): string {
	const { allFilePaths, basePath, convertFilePathsToProtocol, cwd, obsidianVaultName, type } =
		options

	// Make it absolute
	const resolvedUrl = pathExtras.resolveWithBasePath(pathExtras.normalize(decodedUrl), {
		basePath,
		cwd,
	})

	// File names may contain anchor delimiter characters, so try the longest
	// literal file name interpretation first, and only treat those characters as
	// anchor delimiters when no real file matches
	let matchedPath: string | undefined
	let matchedQuery: string | undefined

	for (const { base, query } of pathExtras.getBaseAndQueryCandidates(resolvedUrl)) {
		// Assume extension-less files are .md
		// in Obsidian, ![[these links]] and ![](<these links>) without an extension are always to an MD file
		// Also try adding .md even when there's already an extension, to handle
		// file names with dots in them
		const extensionCandidates = path.extname(base) === '' ? [`${base}.md`] : [base, `${base}.md`]

		matchedPath = extensionCandidates.find((candidate) =>
			pathExistsInAllFiles(candidate, allFilePaths ?? []),
		)

		if (matchedPath !== undefined) {
			matchedQuery = query
			break
		}
	}

	if (matchedPath !== undefined) {
		// Perform obsidian vault link protocol conversion if requested
		// For links, anything that exists should become an obsidian link
		// For embeds, only markdown files should become obsidian links
		if (
			convertFilePathsToProtocol !== 'none' &&
			(type === 'link' ||
				// eslint-disable-next-line ts/no-unnecessary-condition
				(type === 'embed' &&
					// https://help.obsidian.md/Files+and+folders/Accepted+file+formats
					['.md', '.pdf'].includes(path.extname(matchedPath))))
		) {
			if (convertFilePathsToProtocol === 'obsidian' && obsidianVaultName !== undefined) {
				return createObsidianVaultLink(
					`${matchedPath}${matchedQuery ?? ''}`,
					basePath ?? '',
					obsidianVaultName,
				)
			}

			// This doesn't work in the Anki desktop application or the AnkiWeb browser version...
			// Not really worth it
			if (convertFilePathsToProtocol === 'file') {
				return createFileLink(`${matchedPath}${matchedQuery ?? ''}`)
			}
		}

		return matchedPath
	}

	// TODO good idea?
	// Some kind of "assume exists" flag?
	// Linked file was not found, but give up and treat relative links as
	// obsidian vault links if the context suggests it
	// if (
	// 	type === 'link' &&
	// 	convertFilePathsToProtocol === 'obsidian' &&
	// 	obsidianVaultName !== undefined
	// ) {
	// 	return createObsidianVaultLink(
	// 		resolvedUrlWithDefaultExtension,
	// 		basePath ?? '',
	// 		obsidianVaultName,
	// 	)
	// }

	return pathExtras.getBase(resolvedUrl)
}

/**
 * Convert from a (usually wiki-style) named link to an absolute path to an
 * actual file to match Obsidian's undocumented link resolution algorithm.
 *
 * See Obsidian's `getFirstLinkpathDest()` for a roughly equivalent algorithm.
 *
 * Obsidian seems to treat note links slightly differently from image / asset
 * links.
 *
 * @param name Non-URI-encoded, normalized name of the file, with or without a
 *   file extension. Extension-less names are assumed to be .md files. May
 *   include an anchor suffix, or anchor delimiter characters that are a literal
 *   part of the file name. (POSIX-style paths.)
 * @param cwd Absolute path to the current working directory of the file from
 *   which we're resolving the link. (POSIX-style paths)
 * @param allFilePaths Array of absolute paths to all other files in the paths
 *   to be considered. (POSIX-style paths.)
 *
 * @returns Absolute path to the best matching file with the name provided, or
 *   undefined if there's no valid match. (POSIX-style paths.)
 */
function resolveNameLink(name: string, cwd: string, allFilePaths: string[]): string | undefined {
	// Edge case, no file paths provided
	if (allFilePaths.length === 0) {
		return undefined
	}

	// File names may contain anchor delimiter characters, so try the longest
	// literal file name interpretation first, and only treat those characters as
	// anchor delimiters when no real file matches
	for (const { base, query } of pathExtras.getBaseAndQueryCandidates(name)) {
		// Assume extension-less files are .md, as Obsidian does
		const baseWithExtension = path.extname(base) === '' ? `${base}.md` : base
		const match = findBestNameMatch(baseWithExtension, cwd, allFilePaths)

		if (match !== undefined) {
			return `${match}${query ?? ''}`
		}
	}

	return undefined
}

/**
 * Find the best matching file for a name in the list of all file paths.
 * Extracted from `resolveNameLink` so each base and anchor interpretation of
 * the name can be attempted in turn.
 *
 * @param base Non-URI-encoded name of the file with a file extension and no
 *   anchor suffix. (POSIX-style paths.)
 * @param cwd Absolute path to the current working directory of the file from
 *   which we're resolving the link. (POSIX-style paths)
 * @param allFilePaths Array of absolute paths to all other files in the paths
 *   to be considered. (POSIX-style paths.)
 *
 * @returns Absolute path to the best matching file, or undefined if there's no
 *   valid match. (POSIX-style paths.)
 */
function findBestNameMatch(base: string, cwd: string, allFilePaths: string[]): string | undefined {
	// To address https://github.com/kitschpatrol/yanki-obsidian/issues/42, ignore .md extensions when matching
	// Obsidian is not case sensitive
	const baseWithoutMd = base.replace(MD_EXTENSION_REGEX, '').toLowerCase()

	const pathsToName = allFilePaths.filter((filePath) => {
		// Strip .md extensions
		// Name-only files with dots in the name won't match
		// Since add extensionIfMissing won't have added .md to those files
		const pathWithoutMd = filePath.replace(MD_EXTENSION_REGEX, '').toLowerCase()
		return pathWithoutMd.endsWith(baseWithoutMd)
	})

	// No matches found
	if (pathsToName.length === 0) {
		return undefined
	}

	// Fast path, there's only one file with that name
	if (pathsToName.length === 1) {
		return pathsToName[0]
	}

	// Sort the paths to name to find the best match
	const sortedPaths = pathsToName.toSorted((a, b) => {
		// TODO pass type / mode instead instead of inferring resolution strategy
		// from name extension? Images prioritize child paths, as do any names with
		// separators?
		if (!base.endsWith('.md') || base.includes(path.sep)) {
			// Then sort by whether the path contains the cwd
			const aHasCwd = a.startsWith(cwd)
			const bHasCwd = b.startsWith(cwd)

			if (aHasCwd !== bHasCwd) {
				return aHasCwd ? -1 : 1
			}
		}

		// Sort by depth
		const aDepth = a.split(path.sep).length
		const bDepth = b.split(path.sep).length

		if (aDepth !== bDepth) {
			return aDepth - bDepth
		}

		// Then sort by name alphabetically
		return a.localeCompare(b)
	})

	return sortedPaths[0]
}

/**
 * Check for presence of a path in a list in a case-agnostic manner, since
 * Obsidian is not case sensitive.
 *
 * @param filePath Literal file path with file extension and no anchor suffix.
 *   (POSIX-style path.)
 * @param allFilePaths Array of absolute file paths to check. (POSIX-style
 *   paths.)
 *
 * @returns Whether the file path is present in the list of all file paths.
 */
function pathExistsInAllFiles(filePath: string, allFilePaths: string[]): boolean {
	const filePathLowerCase = filePath.toLowerCase()
	return allFilePaths.some((file) => file.toLowerCase().endsWith(filePathLowerCase))
}

function createFileLink(absolutePath: string): string {
	return `file://${absolutePath}`
}

function createObsidianVaultLink(absolutePath: string, basePath: string, obsidianVault: string) {
	const relativePath = pathExtras.stripBasePath(absolutePath, basePath)
	return `obsidian://open?vault=${encodeURIComponent(obsidianVault)}&file=${encodeURIComponent(relativePath)}`
}

export function parseObsidianVaultLink(url: string):
	| undefined
	| {
			linkPath: string
			vaultName: string
	  } {
	// Parse the URL
	const urlObject = safeParseUrl(url)
	if (urlObject === undefined) {
		return undefined
	}

	// Ensure the URL is an obsidian://open type
	if (urlObject.protocol !== 'obsidian:' || urlObject.hostname !== 'open') {
		return undefined
	}

	// Extract the vault and file parameters
	const vault = urlObject.searchParams.get('vault')
	const file = urlObject.searchParams.get('file')

	// Null when the parameter is absent, treat empty strings as missing too
	if (vault === null || vault === '' || file === null || file === '') {
		console.warn('Missing required parameters')
		return undefined
	}

	// Decode
	const decodedVault = safeDecodeURIComponent(vault)
	const decodedFilePath = safeDecodeURIComponent(file)

	if (decodedVault === undefined || decodedFilePath === undefined) {
		return undefined
	}

	// Return the decoded file path
	return {
		linkPath: decodedFilePath,
		vaultName: decodedVault,
	}
}

/* eslint-disable complexity */
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

export type ResolveLinkType =
	// Via a `![[link]]` or `![alt](link)` syntax
	| 'embed'
	// Via a `[[link]]` or `[text](link)` syntax
	| 'link'

export type ResolveLinkOptions = {
	/**
	 * Array of all absolute file paths to consider when resolving wiki-style named links.
	 */
	allFilePaths?: string[] | undefined
	/**
	 * How to treat file paths without a leading `/`, `./`, or `../`
	 * Useful in Obsidian vaults where bare paths can be relative to the vault root
	 * TODO evaluate if this makes sense
	 */
	// barePathsAreRelativeTo: 'base' | 'cwd'
	/**
	 * Custom base path to resolve "absolute" paths against.
	 * Useful in Obsidian vaults where "/" is the root of the vault, not the root of the filesystem.
	 * Must be an absolute directory path.
	 */
	basePath?: string | undefined
	/**
	 * Turns a file path into a URL with a specific protocol.
	 * Useful for converting markdown links to Obsidian vault links.
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
	 * Whether we're dealing with a link (to be `<a>`-tagged) or an embed (to be `<img>`-tagged).
	 * Affects how the resolved path is treated.
	 */
	type: ResolveLinkType
}

export const defaultResolveLinkOptions: Partial<ResolveLinkOptions> = {
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
 * Warning:
 * Wiki name link resolution is CASE INSENSITIVE, like in Obsidian, though
 * the case of the matching file will be preserved in the returned path.
 *
 * @param filePathOrUrl May be one of:
 * - Wiki named link
 * - Relative file path
 * - Bare file path
 * - Absolute file path
 * - HTTP protocol URL string
 * - File protocol URL string
 * - Obsidian protocol URL string
 * (All file paths can be Windows or POSIX, with or without URI encoding, with
 * or without funky Obsidian-style post-extension block and heading anchor
 * additions.)
 *
 * @returns Resolved absolute path or URL One of:
 * - Resolved absolute POSIX-style paths
 *   - Removes any file path query parameters
 *   - Not URI-encoded
 *   - Retains original case
 * - HTTP protocol URL
 * - Obsidian protocol vault URL (Optionally, this will include file query parameters)
 */
export function resolveLink(filePathOrUrl: string, options: ResolveLinkOptions): string {
	// Defaults
	const { allFilePaths, basePath, convertFilePathsToProtocol, cwd, obsidianVaultName, type } =
		deepmerge(defaultResolveLinkOptions, options ?? {}) as ResolveLinkOptions

	// Option validation...
	if (convertFilePathsToProtocol === 'obsidian' && obsidianVaultName === undefined) {
		console.warn(`convertFilePathsToProtocol is 'obsidian', but no obsidianVaultName provided`)
	}

	const decodedUrl = safeDecodeURI(filePathOrUrl) ?? filePathOrUrl

	const sourceType = getSrcType(decodedUrl)

	switch (sourceType) {
		case 'obsidianVaultUrl': {
			// Do nothing
			return filePathOrUrl
		}

		case 'remoteHttpUrl': {
			// Do nothing
			return filePathOrUrl
		}

		case 'localFileUrl': {
			// Convert file:// url to path (file:// paths are already always absolute)
			// Anki can't open them
			const resolvedUrl = pathExtras.normalize(fileUrlToPath(filePathOrUrl))

			// Run it through again as a localFilePath

			// Prevent infinite recursion
			if (getSrcType(resolvedUrl) === 'localFilePath') {
				return resolveLink(resolvedUrl, {
					allFilePaths,
					basePath,
					convertFilePathsToProtocol,
					cwd,
					obsidianVaultName,
					type,
				})
			}

			console.warn(`Failed to convert file URL to path: ${filePathOrUrl} --> ${resolvedUrl}`)
			return resolvedUrl
		}

		case 'localFilePath': {
			// Make it absolute
			const resolvedUrl = pathExtras.resolveWithBasePath(pathExtras.normalize(decodedUrl), {
				basePath,
				cwd,
			})

			// Always try a .md extension if it's missing... in Obsidian, ![[these links]] and ![](<these links>) without an extension are always to an MD file
			const resolvedUrlWithDefaultExtension = pathExtras.addExtensionIfMissing(resolvedUrl, 'md')

			const fileProbablyExists = pathExistsInAllFiles(
				resolvedUrlWithDefaultExtension,
				allFilePaths ?? [],
			)

			if (fileProbablyExists) {
				// Perform obsidian vault link protocol conversion if requested
				// For links, anything that exists should become an obsidian link
				// For embeds, only markdown files should become obsidian links
				if (
					convertFilePathsToProtocol !== 'none' &&
					(type === 'link' ||
						(type === 'embed' &&
							// https://help.obsidian.md/Files+and+folders/Accepted+file+formats
							['.md', '.pdf'].includes(pathExtras.getExtension(resolvedUrlWithDefaultExtension))))
				) {
					if (convertFilePathsToProtocol === 'obsidian' && obsidianVaultName !== undefined) {
						return createObsidianVaultLink(
							resolvedUrlWithDefaultExtension,
							basePath ?? '',
							obsidianVaultName,
						)
					}

					// This doesn't work in the Anki desktop application or the AnkiWeb browser version...
					// Not really worth it
					if (convertFilePathsToProtocol === 'file') {
						return createFileLink(resolvedUrlWithDefaultExtension)
					}
				}

				return pathExtras.getBase(resolvedUrlWithDefaultExtension)
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

		case 'localFileName': {
			let resolvedUrl = pathExtras.addExtensionIfMissing(pathExtras.normalize(decodedUrl), 'md')

			// Fall back to base path resolution if there's no path
			const resolvedNameLink = resolveNameLink(resolvedUrl, cwd, allFilePaths ?? [])

			resolvedUrl =
				resolvedNameLink ??
				pathExtras.resolveWithBasePath(decodedUrl, {
					basePath,
					cwd,
				})

			// Run it through again as a relative localFilePath

			// Prevent infinite recursion
			if (getSrcType(resolvedUrl) === 'localFilePath') {
				return resolveLink(resolvedUrl, {
					allFilePaths,
					basePath,
					convertFilePathsToProtocol,
					cwd,
					obsidianVaultName,
					type,
				})
			}

			console.warn(
				`Failed to convert local file wiki-style name to path: ${filePathOrUrl} --> ${resolvedUrl}`,
			)
			return resolvedUrl
		}

		case 'unsupportedProtocolUrl': {
			console.warn(`Unsupported URL protocol: ${filePathOrUrl}`)
			return filePathOrUrl
		}
	}
}

/**
 * Convert from a (usually wiki-style) named link to an absolute path to an
 * actual file to match Obsidian's undocumented link resolution algorithm.
 *
 * See Obsidian's `getFirstLinkpathDest()` for a roughly equivalent algorithm.
 *
 * Obsidian seems to treat note links slightly differently from image / asset links.
 *
 * @param name Non-URI-encoded name of the file, with presumed file extension. (POSIX-style paths.)
 * @param cwd Absolute path to the current working directory of the file from
 * which we're resolving the link. (POSIX-style paths)
 * @param allFilePaths Array of absolute paths to all other files in the paths
 * to be considered. (POSIX-style paths.)
 *
 * @returns Absolute path to the best matching file with the name provided, or
 * undefined if there's no valid match. (POSIX-style paths.)
 */
function resolveNameLink(name: string, cwd: string, allFilePaths: string[]): string | undefined {
	// Edge case, no file paths provided
	if (allFilePaths.length === 0) {
		return undefined
	}

	const [base, query] = pathExtras.getBaseAndQueryParts(name)

	const pathsToName = allFilePaths.filter((filePath) =>
		// Obsidian is not case sensitive
		filePath.toLowerCase().endsWith(base.toLowerCase()),
	)

	if (pathsToName.length === 0) {
		return undefined
	}

	// Fast path, there's only one file with that name
	if (pathsToName.length === 1) {
		return `${pathsToName[0]}${query ?? ''}`
	}

	// Sort the paths to name to find the best match
	const sortedPaths = [...pathsToName].sort((a, b) => {
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

		// Markdown files prioritize depth
		// if (base.endsWith('.md')) {
		// 	// Then sort by whether the path contains the cwd
		// 	const aHasCwd = a.startsWith(cwd)
		// 	const bHasCwd = b.startsWith(cwd)

		// 	if (aHasCwd !== bHasCwd) {
		// 		return aHasCwd ? -1 : 1
		// 	}
		// }

		// Then sort by name alphabetically
		return a.localeCompare(b)
	})

	return `${sortedPaths[0]}${query ?? ''}`

	// Fast path, perfect match
	// for (const filePath of pathsToName) {
	// 	if (filePath.toLowerCase() === path.join(cwd, `${base}`).toLowerCase()) {
	// 		return path.join(cwd, name)
	// 	}
	// }

	// Not needed?
	// const storedCwd = path.process_cwd
	// path.setCWD(cwd)
	// const relativePathsToName = pathsToName.map((filePath) => path.relative(cwd, filePath))
	// path.setCWD(storedCwd)
	//
	// relativePathsToName.sort((a, b) => {
	// 	// Prefer fewest number of up-traversals
	// 	const { down: aStepsDown, up: aStepsUp } = pathExtras.quantifyPathDistance(a)
	// 	const { down: bStepsDown, up: bStepsUp } = pathExtras.quantifyPathDistance(b)
	//
	// 	// Sort first by shortest number of steps "down"
	// 	if (aStepsDown !== bStepsDown) {
	// 		return aStepsDown - bStepsDown
	// 	}
	//
	// 	// Then sort by shortest number of steps "up"
	// 	if (aStepsUp !== bStepsUp) {
	// 		// Doesn't help
	// 		// return aStepsUp - bStepsUp
	// 	}
	//
	// 	// Sort second by name alphabetically
	// 	return 0 // A.localeCompare(b)
	// })
	//
	// return path.join(cwd, `${relativePathsToName[0]}${query ?? ''}`)
}

/**
 * Check for presence of a path in a list in a case- and query- agnostic manner.
 *
 * @param filePath File path with file extension. (POSIX-style path.)
 * @param allFilePaths Array of absolute file paths to check. (POSIX-style paths.)
 * @returns True if the file path is present in the list of all file paths.
 */
function pathExistsInAllFiles(filePath: string, allFilePaths: string[]): boolean {
	const base = pathExtras.getBase(filePath)

	// Obsidian is not case sensitive
	return allFilePaths.some((file) => file.toLowerCase().endsWith(base.toLowerCase()))
}

export function createFileLink(absolutePath: string): string {
	return `file://${absolutePath}`
}

export function createObsidianVaultLink(
	absolutePath: string,
	basePath: string,
	obsidianVault: string,
) {
	const relativePath = pathExtras.stripBasePath(absolutePath, basePath)
	return `obsidian://open?vault=${encodeURIComponent(obsidianVault)}&file=${encodeURIComponent(relativePath)}`
}

export function parseObsidianVaultLink(url: string):
	| {
			linkPath: string
			vaultName: string
	  }
	| undefined {
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

	if (!vault || !file) {
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

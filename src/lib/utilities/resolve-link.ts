/* eslint-disable complexity */

// TODO move this into its own package?

import * as pathExtras from './path'
import {
	fileUrlToPath,
	getSrcType,
	safeDecodeURI,
	safeDecodeURIComponent,
	safeParseUrl,
} from './url'
import { deepmerge } from 'deepmerge-ts'
import path from 'path-browserify-esm'
import slash from 'slash'

export type ResolveLinkOptions = {
	/**
	 * Array of all absolute file paths to consider when resolving wiki-style named links.
	 */
	allFilePaths: string[] | undefined
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
	basePath: string | undefined
	/**
	 * Turns a file path into a URL with a specific protocol.
	 * Useful for converting markdown links to Obsidian vault links.
	 */
	convertFilePathsToProtocol: 'none' | 'obsidian'
	/**
	 * Current working directory, used to resolve relative paths. Set to the
	 * absolute path of the file being processed.
	 */
	cwd: string
	/**
	 * A file extension, without the leading `.` to add to file paths to assist in resolving wiki style named links.
	 */
	defaultExtension: string | undefined
	/**
	 * Name of Obsidian vault, used in Obsidian protocol URL creation.
	 */
	obsidianVaultName: string | undefined
}

export const defaultResolveLinkOptions = {
	allFilePaths: [],
	// TODO consider...
	// barePathsAreRelativeTo: 'cwd',
	basePath: undefined,
	convertFilePathsToProtocol: 'none',
	cwd: undefined,
	defaultExtension: undefined,
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
export function resolveLink(filePathOrUrl: string, options?: Partial<ResolveLinkOptions>): string {
	// Defaults
	const {
		allFilePaths,
		basePath,
		convertFilePathsToProtocol,
		cwd,
		defaultExtension,
		obsidianVaultName,
	} = deepmerge(defaultResolveLinkOptions, options ?? {}) as ResolveLinkOptions

	// Option validation...
	if (convertFilePathsToProtocol === 'obsidian' && obsidianVaultName === undefined) {
		console.warn(`convertFilePathsToProtocol is 'obsidian', but no obsidianVaultName provided`)
	}

	const decodedUrl = safeDecodeURI(filePathOrUrl)
	if (decodedUrl === undefined) {
		return filePathOrUrl
	}

	const sourceType = getSrcType(decodedUrl)

	// Temp debug
	// console.log(`sourceType: ${sourceType}`)

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
			const resolvedUrl = slash(fileUrlToPath(filePathOrUrl))

			// Run it through again as a localFilePath

			// Prevent infinite recursion
			if (getSrcType(resolvedUrl) === 'localFilePath') {
				return resolveLink(resolvedUrl, {
					allFilePaths,
					basePath,
					convertFilePathsToProtocol,
					cwd,
					defaultExtension,
					obsidianVaultName,
				})
			}

			console.warn(`Failed to convert file URL to path: ${filePathOrUrl} --> ${resolvedUrl}`)
			return resolvedUrl
		}

		case 'localFilePath': {
			// Make it absolute
			const resolvedUrl = pathExtras.resolveWithBasePath(slash(decodedUrl), {
				basePath,
				cwd,
			})

			// Images won't have a default extension, so fileProbably exists will likely be false, and that's fine
			// since we'll fall through to normal absolute link resolution
			const resolvedUrlWithDefaultExtension =
				defaultExtension === undefined
					? resolvedUrl
					: pathExtras.addExtensionIfMissing(resolvedUrl, defaultExtension)

			const fileProbablyExists = pathExistsInAllFiles(
				resolvedUrlWithDefaultExtension,
				allFilePaths ?? [],
			)

			if (fileProbablyExists) {
				// Perform obsidian vault link protocol conversion if requested
				if (convertFilePathsToProtocol === 'obsidian' && obsidianVaultName !== undefined) {
					return createObsidianVaultLink(
						resolvedUrlWithDefaultExtension,
						basePath ?? '',
						obsidianVaultName,
					)
				}

				return pathExtras.getBase(resolvedUrlWithDefaultExtension)
			}

			// TMI, will be reported later if unsupported
			// console.warn(
			// 	`File not found in allFilePaths: "${resolvedUrl}", resolving as a normal absolute link. (Default extension: "${defaultExtension}".)`,
			// )
			return pathExtras.getBase(resolvedUrl)
		}

		case 'localFileName': {
			let resolvedUrl = slash(
				defaultExtension === undefined
					? decodedUrl
					: pathExtras.addExtensionIfMissing(decodedUrl, defaultExtension),
			)

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
					defaultExtension,
					obsidianVaultName,
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
		// Images prioritize child paths, as do any names with separators?
		if (!base.endsWith('.md') || base.includes(path.posix.sep)) {
			// Then sort by whether the path contains the cwd
			const aHasCwd = a.startsWith(cwd)
			const bHasCwd = b.startsWith(cwd)

			if (aHasCwd !== bHasCwd) {
				return aHasCwd ? -1 : 1
			}
		}

		// Sort by depth
		const aDepth = a.split(path.posix.sep).length
		const bDepth = b.split(path.posix.sep).length

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
	// 	if (filePath.toLowerCase() === path.posix.join(cwd, `${base}`).toLowerCase()) {
	// 		return path.posix.join(cwd, name)
	// 	}
	// }

	// Not needed?
	// const storedCwd = path.posix.process_cwd
	// path.posix.setCWD(cwd)
	// const relativePathsToName = pathsToName.map((filePath) => path.posix.relative(cwd, filePath))
	// path.posix.setCWD(storedCwd)
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
	// return path.posix.join(cwd, `${relativePathsToName[0]}${query ?? ''}`)
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

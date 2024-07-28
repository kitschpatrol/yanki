/* eslint-disable complexity */
// TODO move this into its own package?

import * as pathExtras from './path'
import { fileUrlToPath, getSrcType } from './url'
import { deepmerge } from 'deepmerge-ts'
import path from 'path-browserify-esm'
import slash from 'slash'

function createObsidianVaultLink(absolutePath: string, basePath: string, obsidianVault: string) {
	const relativePath = pathExtras.stripBasePath(absolutePath, basePath)
	return `obsidian://open?vault=${encodeURIComponent(obsidianVault)}&file=${encodeURIComponent(relativePath)}`
}

/**
 * Convert from a (usually wiki-style) named link to an absolute path to an actual file
 *
 * Tries to reimplement the logic of the Obsidian link resolver...
 * Particularly `getFirstLinkpathDest()`
 *
 * @param name Non-URI-encoded name of the file
 * @param cwd Absolute path to the current working directory
 * @param allFilePaths Array of absolute paths to all other files in the paths to be considered
 * @returns Absolute path to the best matching file with the name provided, or undefined if there's no match
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

	if (name.startsWith('test image.jpg')) {
		console.log('----------------TEST CARD------------------')
		console.log(`name: ${name}`)
		console.log(pathsToName)
	}

	if (pathsToName.length === 0) {
		return undefined
	}

	// Fast path, there's only one file with that name
	if (pathsToName.length === 1) {
		return `${pathsToName[0]}${query ?? ''}`
	}

	// Find whichever has the shortest path relative to the base
	const relativePathsToBase = [...pathsToName].sort(
		(a, b) => a.split(path.posix.sep).length - b.split(path.posix.sep).length,
	)
	return `${relativePathsToBase[0]}${query ?? ''}`

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

	// relativePathsToName.sort((a, b) => {
	// 	// Prefer fewest number of up-traversals
	// 	const { down: aStepsDown, up: aStepsUp } = pathExtras.quantifyPathDistance(a)
	// 	const { down: bStepsDown, up: bStepsUp } = pathExtras.quantifyPathDistance(b)

	// 	// Sort first by shortest number of steps "down"
	// 	if (aStepsDown !== bStepsDown) {
	// 		return aStepsDown - bStepsDown
	// 	}

	// 	// Then sort by shortest number of steps "up"
	// 	if (aStepsUp !== bStepsUp) {
	// 		// Doesn't help
	// 		// return aStepsUp - bStepsUp
	// 	}

	// 	// Sort second by name alphabetically
	// 	return 0 // A.localeCompare(b)
	// })

	// //
	// // console.log('----------------------------------')
	// // console.log(`cwd: ${cwd}`)
	// // console.log(`name: ${name}`)
	// // console.log(`match: ${path.posix.join(cwd, `${relativePathsToName[0]}${query ?? ''}`)}`)
	// // console.log(pathsToName)
	// // console.log(relativePathsToName)

	// return path.posix.join(cwd, `${relativePathsToName[0]}${query ?? ''}`)
}

/**
 * Assumes file extension has been added if missing
 * @param filePath
 * @param allFilePaths
 * @returns
 */
function pathExistsInAllFiles(filePath: string, allFilePaths: string[]): boolean {
	const [base] = pathExtras.getBaseAndQueryParts(filePath)

	// Temp debug
	// console.log(`base: ${base}`)
	// Obsidian is not case sensitive
	return allFilePaths.some((file) => file.toLowerCase().endsWith(base.toLowerCase()))
}

export type ResolveFilePathOrUrlOptions = {
	/**
	 * Array of all absolute file paths to consider when resolving wiki-style named links.
	 */
	allFilePaths: string[] | undefined
	/**
	 * How to treat file paths without a leading `/`, `./`, or `../`
	 * Useful in Obsidian vaults where bare paths can be relative to the vault root
	 * TODO evaluate if this makes sense
	 */
	barePathsAreRelativeTo: 'base' | 'cwd'
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

export const defaultResolveFilePathOrUrlOptions = {
	allFilePaths: [],
	barePathsAreRelativeTo: 'cwd',
	basePath: undefined,
	convertFilePathsToProtocol: 'none',
	cwd: undefined,
	defaultExtension: undefined,
	obsidianVaultName: undefined,
}

/**
 * Resolve a file path or URL to an absolute path, handling Wiki-style named links
 *
 * @param filePathOrUrl May be one of:
 * - Wiki named link
 * - Relative file path
 * - Bare file path
 * - Absolute file path
 * - HTTP protocol URL string
 * - File protocol URL string
 * - Obsidian protocol URL string (All file paths can be Windows or POSIX, with
 *   or without URI encoding, with or without funky post-extension additions)
 *
 *
 * @returns Resolved absolute path or URL One of:
 * - Resolved absolute POSIX-style paths
 *   - Removes any file path query parameters
 *   - Not URI-encoded
 *   - Retains original case
 * - HTTP protocol URL
 * - Obsidian protocol vault URL (Optionally, this will include file query parameters)
 *
 * Warning:
 *
 * Wiki name link resolution is CASE INSENSITIVE, like Obsidian, though
 * the case of the matching file will be preserved in the returned path
 */
export function resolveFilePathOrUrl(
	filePathOrUrl: string,
	options?: Partial<ResolveFilePathOrUrlOptions>,
): string {
	// Defaults
	const {
		allFilePaths,
		basePath,
		convertFilePathsToProtocol,
		cwd,
		defaultExtension,
		obsidianVaultName,
	} = deepmerge(defaultResolveFilePathOrUrlOptions, options ?? {}) as ResolveFilePathOrUrlOptions

	// Option validation...
	if (convertFilePathsToProtocol === 'obsidian' && obsidianVaultName === undefined) {
		console.warn(`convertFilePathsToProtocol is 'obsidian', but no obsidianVaultName provided`)
	}

	let decodedUrl: string | undefined

	try {
		decodedUrl = decodeURI(filePathOrUrl)
	} catch (error) {
		console.warn(`Error decoding src: ${filePathOrUrl}`, error)
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
				return resolveFilePathOrUrl(resolvedUrl, {
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

			console.warn(
				`File not found in allFilePaths: ${resolvedUrl}, resolving as a normal absolute link.`,
			)
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
				return resolveFilePathOrUrl(resolvedUrl, {
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

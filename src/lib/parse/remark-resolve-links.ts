import { getBaseAndQueryParts, resolveWithBasePath, stripBasePath } from '../utilities/file'
import { fileUrlToPath, getSrcType } from '../utilities/url'
import { type Root } from 'mdast'
import path from 'path-browserify-esm'
import { type Plugin } from 'unified'
import { visit } from 'unist-util-visit'

export type Options = {
	allFilePaths?: string[]
	basePath?: string
	cwd: string
	enabled?: boolean
	obsidianVault?: string
}

function quantifyPathDistance(relativePath: string): { down: number; up: number } {
	const up = relativePath.split('../').length
	const down = relativePath.replaceAll('../', '').split('/').length

	return { down, up }
}

/**
 * Convert from a (usually wiki-style) named link to a relative path to an actual file
 *
 * Tries to reimplement the logic of the Obsidian link resolver...
 * Particularly `getFirstLinkpathDest()`
 *
 * @param name Non-URI-encoded name of the file
 * @param cwd Absolute path to the current working directory
 * @param allFilePaths Array of absolute paths to all other files in the paths to be considered
 * @returns Shortest relative path to a file with the name provided, or undefined if there's no match
 */
function resolveNameLink(name: string, cwd: string, allFilePaths: string[]): string | undefined {
	// Edge case, no file paths provided
	if (allFilePaths.length === 0) {
		return undefined
	}

	const [base, query] = getBaseAndQueryParts(name)

	const pathsToName = allFilePaths.filter((filePath) =>
		// Obsidian is not case sensitive
		filePath.toLowerCase().endsWith(base.toLowerCase()),
	)

	if (pathsToName.length === 0) {
		return undefined
	}

	const storedCwd = path.process_cwd
	path.setCWD(cwd)
	const relativePathsToName = pathsToName.map((filePath) => path.relative(cwd, filePath))
	path.setCWD(storedCwd)

	// Fast path, there's only one file with that name
	if (relativePathsToName.length === 1) {
		return path.join(cwd, `${relativePathsToName[0]}${query ?? ''}`)
	}

	relativePathsToName.sort((a, b) => {
		// Prefer fewest number of up-traversals
		const { down: aStepsDown, up: aStepsUp } = quantifyPathDistance(a)
		const { down: bStepsDown, up: bStepsUp } = quantifyPathDistance(b)

		// Sort first by shortest number of steps "down"
		if (aStepsDown !== bStepsDown) {
			return aStepsDown - bStepsDown
		}

		// Then sort by shortest number of steps "up"
		if (aStepsUp !== bStepsUp) {
			return aStepsUp - bStepsUp
		}

		// Sort second by name alphabetically
		return a.localeCompare(b)
	})

	return path.join(cwd, `${relativePathsToName[0]}${query ?? ''}`)
}

function createObsidianVaultLink(absolutePath: string, basePath: string, obsidianVault: string) {
	const relativePath = stripBasePath(absolutePath, basePath)
	return `obsidian://open?vault=${encodeURIComponent(obsidianVault)}&file=${encodeURIComponent(relativePath)}`
}

function resolveUrl(
	url: string,
	allFilePaths: string[],
	basePath: string | undefined,
	cwd: string,
	obsidianVault: string | undefined,
	type: 'image' | 'link',
): string {
	let decodedUrl: string | undefined

	try {
		decodedUrl = decodeURI(url)
	} catch (error) {
		console.warn(`Error decoding src: ${url}`, error)
		return url
	}

	const sourceType = getSrcType(decodedUrl)

	// Temp debug
	// console.log(`sourceType: ${sourceType}`)

	switch (sourceType) {
		case 'obsidianVaultUrl': {
			// Do nothing
			return url
		}

		case 'remoteHttpUrl': {
			// Do nothing
			return url
		}

		case 'localFileUrl': {
			// Convert file:// url to path (file:// paths are already always absolute)
			// Anki can't open them
			const resolvedUrl = fileUrlToPath(url)

			// Run it through again as a localFilePath

			// Prevent infinite recursion
			if (getSrcType(resolvedUrl) === 'localFilePath') {
				return resolveUrl(resolvedUrl, allFilePaths, basePath, cwd, obsidianVault, type)
			}

			console.warn(`Failed to convert file URL to path: ${url} --> ${resolvedUrl}`)
			return resolvedUrl
		}

		case 'localFileName': {
			let resolvedUrl = type === 'link' ? addExtensionIfMissing(decodedUrl, 'md') : decodedUrl

			// Fall back to base path resolution if there's no path
			resolvedUrl =
				resolveNameLink(stripBasePath(decodedUrl, basePath ?? ''), cwd, allFilePaths) ??
				resolveWithBasePath(decodedUrl, {
					basePath,
					cwd,
					obsidianMode: obsidianVault !== undefined,
				})

			// Run it through again as a relative localFilePath

			// Prevent infinite recursion
			if (getSrcType(resolvedUrl) === 'localFilePath') {
				return resolveUrl(resolvedUrl, allFilePaths, basePath, cwd, obsidianVault, type)
			}

			console.warn(
				`Failed to convert local file wiki-style name to path: ${url} --> ${resolvedUrl}`,
			)
			return resolvedUrl
		}

		case 'localFilePath': {
			// Make it absolute
			let resolvedUrl = resolveWithBasePath(decodedUrl, {
				basePath,
				cwd,
				obsidianMode: obsidianVault !== undefined,
			})

			if (type === 'link') {
				// Assume markdown if it's a link
				resolvedUrl = addExtensionIfMissing(resolvedUrl, 'md')

				// Turn into an Obsidian vault link
				if (obsidianVault !== undefined) {
					if (pathExistsInAllFiles(stripBasePath(resolvedUrl, basePath ?? ''), allFilePaths)) {
						return createObsidianVaultLink(resolvedUrl, basePath ?? '', obsidianVault)
					}

					console.warn(
						`File not found in allFilePaths: ${resolvedUrl}, resolving as a normal absolute link.`,
					)
				}
			}

			return encodeURI(resolvedUrl)
		}

		case 'unsupportedProtocolUrl': {
			console.warn(`Unsupported URL protocol: ${url}`)
			return url
		}
	}
}

function addExtensionIfMissing(filePath: string, extension: string): string {
	const [base, query] = getBaseAndQueryParts(filePath)
	const baseWithExtension = path.extname(base) === '' ? `${base}.${extension}` : base
	return `${baseWithExtension}${query ?? ''}`
}

/**
 * Assumes file extension has been added if missing
 * @param filePath
 * @param allFilePaths
 * @returns
 */
function pathExistsInAllFiles(filePath: string, allFilePaths: string[]): boolean {
	const [base] = getBaseAndQueryParts(filePath)

	// Temp debug
	// console.log(`base: ${base}`)
	// Obsidian is not case sensitive
	return allFilePaths.some((file) => file.toLowerCase().endsWith(base.toLowerCase()))
}

const plugin: Plugin<[Options], Root> = function (options) {
	const { allFilePaths = [], basePath, cwd, enabled = true, obsidianVault } = options

	return function (tree) {
		// Disable so we can A/B test
		if (!enabled) {
			return
		}

		visit(tree, 'link', (node) => {
			// Temp debug
			// console.log('----------------------------------')
			// console.log(`url: ${node.url}`)
			// console.log(`cwd: ${cwd}`)
			node.url = resolveUrl(node.url, allFilePaths, basePath, cwd, obsidianVault, 'link')
			// Temp debug
			// console.log(`node.url: ${node.url}`)
		})

		visit(tree, 'image', (node) => {
			// Temp debug
			// console.log('----------------------------------')
			// console.log(`url: ${node.url}`)
			// console.log(`cwd: ${cwd}`)
			node.url = resolveUrl(node.url, allFilePaths, basePath, cwd, obsidianVault, 'image')
			// Temp debug
			// console.log(`node.url: ${node.url}`)
		})
	}
}

export default plugin

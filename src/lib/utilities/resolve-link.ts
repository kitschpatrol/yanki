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

const LEADING_AND_TRAILING_SLASHES_REGEX = /^\/+|\/+$/gu
const TRAILING_SLASHES_REGEX = /\/+$/u

type ResolveLinkType =
	// Via a `![[link]]` or `![alt](link)` syntax
	| 'embed'
	// Via a `[[link]]` or `[text](link)` syntax
	| 'link'

type ResolvedLocalLink = {
	anchor: string | undefined
	filePath: string
}

/**
 * A file from `allFilePaths`, addressed the way Obsidian addresses the files in
 * a vault.
 */
type VaultFile = {
	/** Absolute path, exactly as provided in `allFilePaths`. */
	filePath: string
	/** Path relative to the vault root, without a leading slash. */
	vaultPath: string
	/** Lowercase vault path, since Obsidian's link resolution is case insensitive. */
	vaultPathLowerCase: string
}

type ResolveLinkOptions = {
	/**
	 * Array of all absolute file paths to consider when resolving local links.
	 * When several files are equally good matches for a link, the one listed
	 * first wins, just as Obsidian breaks ties by the order of files in the
	 * vault.
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
	 * absolute path of the directory of the file being processed. Ignored when
	 * `sourcePath` is given.
	 */
	cwd: string
	/**
	 * Name of Obsidian vault, used in Obsidian protocol URL creation.
	 */
	obsidianVaultName?: string | undefined
	/**
	 * Absolute path of the file being processed. Links without a path, like
	 * `[[#Heading]]`, lead back to it, and its directory takes precedence over
	 * `cwd`.
	 */
	sourcePath?: string | undefined
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
	sourcePath: undefined,
}

/**
 * Resolve a file path, URL, or wiki-style named links to an absolute path.
 *
 * Local links are matched against `allFilePaths` exactly as Obsidian matches
 * them against the files in a vault, see `getLinkpathDestinations()`.
 *
 * Warning: Local link resolution is CASE INSENSITIVE, like in Obsidian, though
 * the case of the matching file will be preserved in the returned path.
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
	const resolvedOptions =
		// eslint-disable-next-line ts/no-unnecessary-condition
		deepmerge(defaultResolveLinkOptions, options ?? {}) as ResolveLinkOptions
	const { convertFilePathsToProtocol, obsidianVaultName } = resolvedOptions

	// Option validation...
	if (convertFilePathsToProtocol === 'obsidian' && obsidianVaultName === undefined) {
		console.warn(`convertFilePathsToProtocol is 'obsidian', but no obsidianVaultName provided`)
	}

	const decodedUrl = safeDecodeURI(filePathOrUrl) ?? filePathOrUrl

	switch (getSrcType(decodedUrl)) {
		// Obsidian resolves names and paths with the same algorithm
		case 'localFileName':
		case 'localFilePath': {
			return resolveLocalLink(decodedUrl, resolvedOptions)
		}

		case 'localFileUrl': {
			// Convert file:// URLs to paths; Anki cannot open them. Use the original
			// encoded URL for parsing, then decode its extracted path for matching.
			const encodedFilePath = fileUrlToPath(filePathOrUrl)
			const decodedFilePath = safeDecodeURI(encodedFilePath) ?? encodedFilePath
			return resolveLocalLink(decodedFilePath, resolvedOptions)
		}

		case 'obsidianVaultUrl':
		case 'remoteHttpUrl': {
			// Preserve already-valid URLs exactly as provided.
			return filePathOrUrl
		}

		case 'unsupportedProtocolUrl': {
			console.warn(`Unsupported URL protocol: ${filePathOrUrl}`)
			return filePathOrUrl
		}
	}
}

/**
 * Resolve a decoded local wiki-style name or file path to an absolute path or
 * protocol URL.
 */
function resolveLocalLink(decodedLink: string, options: ResolveLinkOptions): string {
	const { allFilePaths = [], basePath, sourcePath } = options
	// Links lead from the directory of the file they're in
	const cwd = sourcePath === undefined ? options.cwd : path.dirname(sourcePath)
	// Obsidian resolves links against the vault root. Without a known one, the
	// deepest directory containing every file stands in for it. (Public options
	// may carry a null basePath from JavaScript callers.)
	const isVaultRootKnown = typeof basePath === 'string'
	const vaultRoot = isVaultRootKnown ? basePath : getCommonDirectory(cwd, allFilePaths)
	const sourceDirectory = getVaultPath(cwd, vaultRoot).toLowerCase()
	const lowerCaseFilePaths = allFilePaths.map((filePath) => filePath.toLowerCase())

	// Stands in for Obsidian's index of the files in a vault by lowercase name
	const getFilesNamed = (fileName: string): VaultFile[] => {
		const pathEnding = `/${fileName}`

		return (
			allFilePaths
				// Index is in bounds, since the arrays are parallel
				.filter((_, index) => lowerCaseFilePaths[index]!.endsWith(pathEnding))
				.map((filePath) => {
					const vaultPath = getVaultPath(filePath, vaultRoot)
					return { filePath, vaultPath, vaultPathLowerCase: vaultPath.toLowerCase() }
				})
		)
	}

	// Obsidian has no notion of absolute file system paths, but they turn up in
	// Markdown links and `file:` URLs
	const getFileAtAbsolutePath = (absolutePath: string): string | undefined => {
		if (!pathExtras.isAbsolute(absolutePath)) {
			return undefined
		}

		const target = absolutePath.toLowerCase()
		const exactIndex = lowerCaseFilePaths.indexOf(target)
		const index = exactIndex === -1 ? lowerCaseFilePaths.indexOf(`${target}.md`) : exactIndex

		return index === -1 ? undefined : allFilePaths[index]
	}

	// Obsidian stops relative links at the vault root, but a stand-in root says
	// nothing about what lies above it, so a link leading there is followed as a
	// plain file system path instead
	const getLinkedFile = (linkPath: string): string | undefined =>
		!isVaultRootKnown && path.join(sourceDirectory, linkPath).startsWith('../')
			? getFileAtAbsolutePath(path.join(cwd, linkPath))
			: (getLinkpathDestinations(linkPath, sourceDirectory, getFilesNamed)[0]?.filePath ??
				getFileAtAbsolutePath(linkPath))

	const candidates = pathExtras.getLocalPathCandidates(decodedLink)

	// File names may contain anchor delimiter characters, so try the longest
	// literal file name interpretation first, and only treat those characters as
	// anchor delimiters when no real file matches
	for (const { anchor, filePath } of candidates) {
		// A link without a path, like `[[#Heading]]`, leads back to the file it's
		// in, as in Obsidian. Otherwise, normalize only the path portion. Anchor
		// text may contain slashes, dot segments, backslashes, or other characters
		// with path semantics.
		const matchedPath = filePath === '' ? sourcePath : getLinkedFile(pathExtras.normalize(filePath))

		if (matchedPath !== undefined) {
			return resolveMatchedLocalLink({ anchor, filePath: matchedPath }, options)
		}
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

	// With no real file to disambiguate against, retain the historical behavior
	// of treating the first anchor delimiter as the start of the anchor.
	const fallbackBase = candidates.at(-1)?.filePath ?? decodedLink
	return pathExtras.resolveWithBasePath(pathExtras.normalize(fallbackBase), {
		basePath,
		cwd,
	})
}

/** Render a matched local file and its still-unmodified Obsidian anchor. */
function resolveMatchedLocalLink(link: ResolvedLocalLink, options: ResolveLinkOptions): string {
	const { anchor = '', filePath } = link
	// Public options may carry a null basePath from JavaScript callers, which a destructuring default would not replace
	// eslint-disable-next-line unicorn/prefer-default-parameters
	const { basePath, convertFilePathsToProtocol, obsidianVaultName, type } = options

	// For links, anything that exists should become a protocol link. For embeds,
	// only Markdown and PDF files should; other media must remain local paths.
	if (
		convertFilePathsToProtocol !== 'none' &&
		(type === 'link' ||
			// eslint-disable-next-line ts/no-unnecessary-condition
			(type === 'embed' &&
				// https://obsidian.md/help/file-formats
				['.md', '.pdf'].includes(path.extname(filePath))))
	) {
		if (convertFilePathsToProtocol === 'obsidian' && obsidianVaultName !== undefined) {
			return createObsidianVaultLink(link, basePath ?? '', obsidianVaultName)
		}

		// This doesn't work in the Anki desktop application or the AnkiWeb browser version...
		// Not really worth it
		if (convertFilePathsToProtocol === 'file') {
			return createFileLink(`${filePath}${anchor}`)
		}
	}

	return filePath
}

/**
 * Find the files a link could refer to, best match first.
 *
 * This is a port of `MetadataCache.getLinkpathDest()` from Obsidian 1.15.1,
 * which resolves every internal link in a vault: wiki-style or Markdown-style,
 * link or embed, name or path. Its behavior is reproduced as closely as
 * possible, quirks included, so that a link always leads to the file Obsidian
 * would open:
 *
 * 1. Only files whose full name is the link's file name are ever considered, and
 *    `.md` is only appended to the link when its file name has no dot, or when
 *    no file has that exact name.
 * 2. A bare name shared by no other file resolves to that file.
 * 3. A link starting with `./` or `../` resolves against the source directory,
 *    stopping at the vault root.
 * 4. A path that leads to a file from the vault root resolves to that file.
 * 5. Any other link except one starting with `/` falls back to the files whose
 *    path ends with the link, preferring those under the source directory, then
 *    shorter paths, then files listed earlier.
 *
 * @param linkPath Non-URI-encoded, normalized name or path of the linked file,
 *   with or without a file extension, and without an anchor suffix.
 *   (POSIX-style path.)
 * @param sourceDirectory Lowercase vault path of the directory containing the
 *   file from which we're resolving the link, empty for the vault root.
 * @param getFilesNamed Gets every file with a given lowercase name, in vault
 *   order.
 *
 * @returns The matching files, best first, or an empty array if the link does
 *   not resolve.
 */
function getLinkpathDestinations(
	linkPath: string,
	sourceDirectory: string,
	getFilesNamed: (fileName: string) => VaultFile[],
): VaultFile[] {
	let target = linkPath.toLowerCase()
	let fileName = getFileName(target)
	let candidates = fileName.includes('.') ? getFilesNamed(fileName) : []

	if (candidates.length === 0) {
		target += '.md'
		fileName = getFileName(target)
		candidates = getFilesNamed(fileName)
	}

	if (candidates.length === 0) {
		return []
	}

	if (target === fileName && candidates.length === 1) {
		return candidates
	}

	let directory = sourceDirectory

	if (target.startsWith('./') || target.startsWith('../')) {
		if (target.startsWith('./../')) {
			target = target.slice(2)
		}

		if (target.startsWith('./')) {
			target = target.slice(2)
		} else {
			while (target.startsWith('../')) {
				target = target.slice(3)
				directory = getParentPath(directory)
			}
		}

		// The trailing slash and any ascent up the tree both carry over to the
		// source directory preference below, as in Obsidian
		if (directory !== '') {
			directory += '/'
		}

		// Now a path from the vault root
		target = directory + target
	}

	if (target.startsWith('/')) {
		target = target.slice(1)
	}

	const rootMatch = candidates.find((file) => file.vaultPathLowerCase === target)
	if (rootMatch !== undefined) {
		return [rootMatch]
	}

	if (linkPath.startsWith('/')) {
		return []
	}

	const suffixMatches = candidates.filter((file) => file.vaultPathLowerCase.endsWith(target))
	const isUnderDirectory = (file: VaultFile) => file.vaultPathLowerCase.startsWith(directory)
	const byPathLength = (a: VaultFile, b: VaultFile) => a.vaultPath.length - b.vaultPath.length

	return [
		...suffixMatches.filter((file) => isUnderDirectory(file)).toSorted(byPathLength),
		...suffixMatches.filter((file) => !isUnderDirectory(file)).toSorted(byPathLength),
	]
}

/**
 * Convert a path to an Obsidian-style vault path: relative to the vault root,
 * without leading or trailing slashes. Paths outside the vault are relative to
 * the volume root instead.
 *
 * @param filePath Normalized absolute path to a file or directory. (POSIX-style
 *   path.)
 * @param vaultRoot Normalized absolute path to the root directory of the vault.
 *   (POSIX-style path.)
 */
function getVaultPath(filePath: string, vaultRoot: string): string {
	const rootPrefix = `${vaultRoot.replace(TRAILING_SLASHES_REGEX, '')}/`
	// The appended slash lets the vault root itself match
	const isInVault =
		`${filePath}/`.slice(0, rootPrefix.length).toLowerCase() === rootPrefix.toLowerCase()

	return (isInVault ? filePath.slice(rootPrefix.length) : filePath).replaceAll(
		LEADING_AND_TRAILING_SLASHES_REGEX,
		'',
	)
}

/**
 * Find the deepest directory containing a directory and every one of a list of
 * files.
 *
 * @param directory Normalized absolute path to a directory. (POSIX-style path.)
 * @param filePaths Normalized absolute paths to files. (POSIX-style paths.)
 *
 * @returns The path to the common directory with a trailing slash, or an empty
 *   string if the paths have nothing in common.
 */
function getCommonDirectory(directory: string, filePaths: string[]): string {
	// The trailing slash lets the directory itself be the common directory
	const directoryPath = `${directory.replace(TRAILING_SLASHES_REGEX, '')}/`

	// Whatever the first and last paths in sort order have in common is common
	// to every path between them, which saves comparing each path's characters.
	// This runs for every link, and file lists can be long.
	let firstPath = directoryPath
	let lastPath = directoryPath

	for (const filePath of filePaths) {
		if (filePath < firstPath) {
			firstPath = filePath
		} else if (filePath > lastPath) {
			lastPath = filePath
		}
	}

	let commonLength = 0
	while (commonLength < firstPath.length && firstPath[commonLength] === lastPath[commonLength]) {
		commonLength++
	}

	const commonPrefix = firstPath.slice(0, commonLength)
	return commonPrefix.slice(0, commonPrefix.lastIndexOf('/') + 1)
}

/** Get the part of a vault path after its last slash. */
function getFileName(vaultPath: string): string {
	return vaultPath.slice(vaultPath.lastIndexOf('/') + 1)
}

/** Get the part of a vault path before its last slash, empty at the root. */
function getParentPath(vaultPath: string): string {
	return vaultPath.slice(0, Math.max(0, vaultPath.lastIndexOf('/')))
}

function createFileLink(absolutePath: string): string {
	return `file://${absolutePath}`
}

function createObsidianVaultLink(link: ResolvedLocalLink, basePath: string, obsidianVault: string) {
	const relativePath = pathExtras.stripBasePath(link.filePath, basePath)
	const linkPath = `${relativePath}${link.anchor ?? ''}`
	return `obsidian://open?vault=${encodeURIComponent(obsidianVault)}&file=${encodeURIComponent(linkPath)}`
}

export function parseObsidianVaultLink(url: string):
	| undefined
	| {
			linkPath: string
			vaultName: string
	  } {
	// Parse the URL and ensure it's an obsidian://open type
	const urlObject = safeParseUrl(url)
	if (urlObject?.protocol !== 'obsidian:' || urlObject.hostname !== 'open') {
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

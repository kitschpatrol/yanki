/* eslint-disable jsdoc/require-jsdoc */

import isAbsolutePath from '@stdlib/assert-is-absolute-path'
import path from 'path-browserify-esm'
import slash from 'slash'
import { splitAtFirstMatch } from './string'

const WINDOWS_DRIVE_LETTER_REGEX = /^[A-Z]:/iv
// Obsidian anchor delimiters: `#heading` and `#^block` (and bare `^block`).
// `?` is deliberately absent: it has no meaning in Obsidian links or local
// markdown links, and is a legal file name character on macOS and Linux.
// Remote URLs (where `?` queries are real) never reach this code.
// https://github.com/kitschpatrol/yanki/issues/20
const QUERY_FRAGMENT_START_REGEX = /[#^]/v

// Unused...
// function stripLeadingSlash(filePath: string): string {
// 	return filePath.startsWith('/') ? filePath.slice(1) : filePath
// }

/**
 * The browserify polyfill doesn't implement win32 absolute path detection...
 *
 * @param filePath Normalized path
 *
 * @returns Whether the path is absolute
 */
export function isAbsolute(filePath: string): boolean {
	return isAbsolutePath.posix(filePath) || isAbsolutePath.win32(filePath)
}

const RE_WINDOWS_EXTENDED_LENGTH_PATH = /^\\\\\?\\.+/v

// Unused
// const RE_WINDOWS_UNC_PATH = /^\\\\[^\\]+\\[^\\]+/

/**
 * Converts all paths to cross-platform 'mixed' style with forward slashes.
 * Warns on unsupported Windows extended length paths.
 *
 * @param filePath Path to normalize
 *
 * @returns Normalized path
 */
export function normalize(filePath: string): string {
	if (RE_WINDOWS_EXTENDED_LENGTH_PATH.test(filePath)) {
		console.warn(`Unsupported extended length path detected: ${filePath}`)
		return filePath
	}

	// If (RE_WINDOWS_UNC_PATH.test(filePath)) {
	// 	console.warn(`Unsupported UNC path detected: ${filePath}`)
	// 	return path.normalize(filePath)
	// }

	const basicPath = slash(filePath)
	const normalizedPath = path.normalize(basicPath)

	// Tricky cases where we still want leading './' to distinguish between relative and "named"" paths,
	// otherwise it's stripped by normalization
	if (basicPath.startsWith('./')) {
		return `./${normalizedPath}`
	}

	return normalizedPath
}

/**
 * Special handling for `/absolute-path.md` style links in Obsidian and static
 * site generators, where absolute paths are relative to a base path instead of
 * the volume root.
 *
 * Paths starting with Windows drive letters, while technically absolute, are
 * _not_ prepended with the base:
 *
 * - If no base path is provided, paths are resolved relative to the the provided
 *   CWD.
 * - If paths are relative, the base paths are ignored and the CWD is used.
 *
 * All path values are normalized and in 'mixed' platform style.
 */
export function resolveWithBasePath(
	filePath: string,
	options: {
		/**
		 * Relative, absolute, or drive-letter absolute path. Normalized and in the
		 * 'mixed' platform style.
		 */
		basePath?: string | undefined
		/**
		 * Whether to keep prepend the base if the file path already starts with it.
		 * Useful for pseudo-idempotence, but will get it wrong in some edge cases
		 * with duplicative path segments. Defaults to false.
		 */
		compoundBase?: boolean | undefined
		/**
		 * Relative to the volume root. Normalized and in the 'mixed' platform
		 * style.
		 */
		cwd: string
	},
): string {
	// Prep options
	const { basePath, compoundBase = false, cwd } = options

	// Validation
	if (basePath !== undefined) {
		if (!isAbsolute(basePath)) {
			console.warn(`Base path "${basePath}" is not absolute`)
		}

		if (!cwd.startsWith(basePath)) {
			console.warn(`CWD "${cwd}" does not start with base path "${basePath}"`)
		}
	}

	if (!isAbsolute(cwd)) {
		console.warn(`CWD "${cwd}" is not absolute`)
	}

	// Absolute
	if (isAbsolute(filePath)) {
		// Path is absolute by drive letter on Windows, or there's not base path to prepend
		if (
			basePath === undefined ||
			WINDOWS_DRIVE_LETTER_REGEX.test(filePath) ||
			(!compoundBase && filePath.startsWith(basePath))
		) {
			return filePath
		}

		// Resolve over base
		return path.join(basePath, filePath)
	}

	// Relative
	return path.join(cwd, filePath)
}

// Function resolveWithCwd(filePath: string, cwd: string): string {
// 	if (filePath.startsWith('cwd')) {
// 		return filePath
// 	}

// 	return path.join(cwd, filePath)
// }

export function stripBasePath(filePath: string, basePath: string): string {
	if (filePath.toLowerCase().startsWith(basePath.toLowerCase())) {
		return filePath.slice(basePath.length)
	}

	return filePath
}

export function getBaseAndQueryParts(filePath: string): [string, string | undefined] {
	const directoryPath = path.dirname(filePath)
	const fileName = path.basename(filePath)
	const [base, query] = splitAtFirstMatch(fileName, QUERY_FRAGMENT_START_REGEX)
	return [path.join(directoryPath, base), query]
}

/**
 * Get every plausible base and anchor interpretation of a local link target
 * that may contain anchor delimiter characters (`#`, `^`), ordered from the
 * longest literal path (no anchor at all) to the shortest (anchor starts at the
 * first delimiter, matching Obsidian's anchor syntax).
 *
 * This operates on the unnormalized link target and deliberately considers
 * delimiters before slashes. A slash after a delimiter belongs to the anchor,
 * not the file path. File and directory names may also legitimately contain
 * these characters, so callers must normalize only each candidate's `filePath`
 * and try candidates in order against a list of real files.
 * https://github.com/kitschpatrol/yanki/issues/20
 */
export function getLocalPathCandidates(
	linkTarget: string,
): Array<{ anchor: string | undefined; filePath: string }> {
	const candidates: Array<{ anchor: string | undefined; filePath: string }> = [
		{ anchor: undefined, filePath: linkTarget },
	]

	for (let index = linkTarget.length - 1; index >= 0; index--) {
		if (QUERY_FRAGMENT_START_REGEX.test(linkTarget.charAt(index))) {
			candidates.push({
				anchor: linkTarget.slice(index),
				filePath: linkTarget.slice(0, index),
			})
		}
	}

	return candidates
}

export function getBase(filePath: string): string {
	return getBaseAndQueryParts(filePath)[0]
}

export function getQuery(filePath: string): string {
	return getBaseAndQueryParts(filePath).at(1) ?? ''
}

// Function quantifyPathDistance(relativePath: string): { down: number; up: number } {
// 	const up = relativePath.split('../').length - 1
// 	const down = relativePath.replaceAll('../', '').split('/').length - 1

// 	return { down, up }
// }

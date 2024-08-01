import { splitAtFirstMatch } from './string'
import isAbsolutePath from '@stdlib/assert-is-absolute-path'
import path from 'path-browserify-esm'
import slash from 'slash'

// Unused...
// function stripLeadingSlash(filePath: string): string {
// 	return filePath.startsWith('/') ? filePath.slice(1) : filePath
// }

/**
 * The browserify polyfill doesn't implement win32 absolute path detection...
 * @param filePath Normalized path
 * @returns
 */
export function isAbsolute(filePath: string): boolean {
	return isAbsolutePath.posix(filePath) || isAbsolutePath.win32(filePath)
}

const RE_WINDOWS_EXTENDED_LENGTH_PATH = /^\\\\\?\\.+/

// Unused
// const RE_WINDOWS_UNC_PATH = /^\\\\[^\\]+\\[^\\]+/

/**
 * Converts all paths to cross-platform 'mixed' style with forward slashes.
 * Warns on unsupported Windows extended length paths.
 * @param filePath
 * @returns normalized path
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
 * Special handling for `/absolute-path.md` style links in Obsidian
 * and static site generators, where absolute paths are relative to a base path
 * instead of the volume root.
 *

 *
 * Paths starting with Windows drive letters, while technically absolute, are _not_ prepended with the base:
 * - If no base path is provided, paths are resolved relative to the the provided CWD.
 * - If paths are relative, the base paths are ignored and the CWD is used.
 *
 * All path values are normalized and in 'mixed' platform style.
 */
export function resolveWithBasePath(
	filePath: string,
	options: {
		/** Relative, absolute, or drive-letter absolute path. Normalized and in the 'mixed' platform style. */
		basePath?: string | undefined
		/** Whether to keep prepend the base if the file path already starts with it. Useful for pseudo-idempotence, but will get it wrong in some edge cases with duplicative path segments. Defaults to false. */
		compoundBase?: boolean | undefined
		/** Relative to the volume root. Normalized and in the 'mixed' platform style. */
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
			/^[A-Za-z]:/.test(filePath) ||
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

/**
 *
 * @param filePath
 * @param cwd Absolute path
 * @returns
 */
export function resolveWithCwd(filePath: string, cwd: string): string {
	if (filePath.startsWith('cwd')) {
		return filePath
	}

	return path.join(cwd, filePath)
}

export function stripBasePath(filePath: string, basePath: string): string {
	const regex = new RegExp(`^${basePath}`, 'i')
	return filePath.replace(regex, '')
}

export function getBaseAndQueryParts(filePath: string): [string, string | undefined] {
	const directoryPath = path.dirname(filePath)
	const fileName = path.basename(filePath)
	const [base, query] = splitAtFirstMatch(fileName, /[#?^]/)
	return [path.join(directoryPath, base), query]
}

export function getBase(filePath: string): string {
	return getBaseAndQueryParts(filePath)[0]
}

export function getQuery(filePath: string): string {
	return getBaseAndQueryParts(filePath).at(1) ?? ''
}

export function hasExtension(filePath: string): boolean {
	return getExtension(filePath) !== ''
}

export function getExtension(filePath: string): string {
	return path.extname(getBase(filePath))
}

export function addExtensionIfMissing(filePath: string, extension: string): string {
	if (hasExtension(filePath)) {
		return filePath
	}

	const [base, query] = getBaseAndQueryParts(filePath)
	return `${base}.${extension}${query ?? ''}`
}

export function quantifyPathDistance(relativePath: string): { down: number; up: number } {
	const up = relativePath.split('../').length - 1
	const down = relativePath.replaceAll('../', '').split('/').length - 1

	return { down, up }
}

import { splitAtFirstMatch } from './string'
import isAbsolutePath from '@stdlib/assert-is-absolute-path'
import isRelativePath from '@stdlib/assert-is-relative-path'
import path from 'path-browserify-esm'
import slash from 'slash'

function stripLeadingSlash(filePath: string): string {
	return filePath.startsWith('/') ? filePath.slice(1) : filePath
}

/**
 * The browserify polyfill doesn't implement win32 absolute path detection...
 * @param filePath Normalized path
 * @returns
 */
export function isRelative(filePath: string): boolean {
	return isRelativePath(filePath)
}

/**
 * The browserify polyfill doesn't implement win32 absolute path detection...
 * @param filePath Normalized path
 * @returns
 */
export function isAbsolute(filePath: string): boolean {
	return isAbsolutePath(filePath)
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
 * and static site generators, where absolute paths are relative to a base path.
 *
 * Technically not strictly idempotent, in cases where the base path and absolute path
 * already match but should be combined.
 *
 * All paths must be normalized and in 'mixed' style.
 *
 * @param filePath Normalized path
 * @param options Normalized base and cwd
 * @returns
 */
export function resolveWithBasePath(
	filePath: string,
	options: { basePath?: string; cwd: string },
): string {
	// Prep options
	const { basePath, cwd } = options

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

	const originalCwd = path.process_cwd
	path.setCWD(cwd)
	let newPath = filePath
	// Debug
	// console.log('----------------------------------')
	// console.log(`newPath:  ${newPath}`)
	// console.log(`basePath: ${basePath}`)
	// console.log(`cwd:      ${cwd}`)

	// If the path is already absolute, we check if we need to add a base path
	// Base path obviates the CWD
	if (isAbsolute(newPath)) {
		newPath =
			basePath !== undefined && !newPath.startsWith(basePath)
				? path.resolve(basePath, stripLeadingSlash(newPath))
				: newPath
	} else {
		// CWD beats base path for relative paths...
		newPath = path.resolve(cwd, newPath)
	}

	path.setCWD(originalCwd)
	return newPath
}

/**
 *
 * @param filePath
 * @param cwd Absolute path
 * @returns
 */
export function resolveWithCwd(filePath: string, cwd: string): string {
	if (filePath.startsWith('cwd')) {
		return path.normalize(filePath)
	}

	return path.normalize(path.join(cwd, filePath))
}

export function stripBasePath(filePath: string, basePath: string): string {
	const regex = new RegExp(`^${basePath}`, 'i')
	return filePath.replace(regex, '')
}

export function getBaseAndQueryParts(filePath: string): [string, string | undefined] {
	return splitAtFirstMatch(filePath, /[#?^]/)
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

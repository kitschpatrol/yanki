import { splitAtFirstMatch } from './string'
import path from 'path-browserify-esm'

function stripLeadingSlash(filePath: string): string {
	return filePath.startsWith('/') ? filePath.slice(1) : filePath
}

/**
 * Special handling for `/absolute-path.md` style links in Obsidian
 * and static site generators, where absolute paths are relative to a base path.
 *
 * Technically not strictly idempotent, in cases where the base path and absolute path
 * already match but should be combined.
 *
 * @param filePath
 * @param options
 * @returns
 */
export function resolveWithBasePath(
	filePath: string,
	options: { basePath?: string; cwd: string },
): string {
	// Prep options
	const basePath =
		options.basePath === undefined ? undefined : path.posix.normalize(options.basePath)
	const cwd = path.posix.normalize(options.cwd)

	// Validation
	if (basePath !== undefined) {
		if (!path.posix.isAbsolute(basePath)) {
			console.warn(`Base path "${basePath}" is not absolute`)
		}

		if (!cwd.startsWith(basePath)) {
			console.warn(`CWD "${cwd}" does not start with base path "${basePath}"`)
		}
	}

	if (!path.posix.isAbsolute(cwd)) {
		console.warn(`CWD "${cwd}" is not absolute`)
	}

	const originalCwd = path.posix.process_cwd
	path.posix.setCWD(cwd)
	let newPath = path.posix.normalize(filePath)
	// Debug
	// console.log('----------------------------------')
	// console.log(`newPath:  ${newPath}`)
	// console.log(`basePath: ${basePath}`)
	// console.log(`cwd:      ${cwd}`)

	// If the path is already absolute, we check if we need to add a base path
	// Base path obviates the CWD
	if (path.posix.isAbsolute(newPath)) {
		newPath =
			basePath !== undefined && !newPath.startsWith(basePath)
				? path.posix.resolve(basePath, stripLeadingSlash(newPath))
				: newPath
	} else {
		// CWD beats base path for relative paths...
		newPath = path.posix.resolve(cwd, newPath)
	}

	path.posix.setCWD(originalCwd)
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
		return path.posix.normalize(filePath)
	}

	return path.posix.normalize(path.posix.join(cwd, filePath))
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
	return path.posix.extname(getBase(filePath))
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

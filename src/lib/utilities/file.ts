import { environment } from './platform'
import { getHash, getNamespaceHash } from './string'
import slugify from '@sindresorhus/slugify'
import path from 'path-browserify-esm'

export async function validateFileFunctions(
	readFile?: (filePath: string) => Promise<string>,
	writeFile?: (filePath: string, data: string) => Promise<void>,
	rename?: (oldPath: string, newPath: string) => Promise<void>,
): Promise<{
	readFile: (filePath: string) => Promise<string>
	rename: (oldPath: string, newPath: string) => Promise<void>
	writeFile: (filePath: string, data: string) => Promise<void>
}> {
	// Validate file implementations, or provide Node's default implementations if the platform environment allows
	if (readFile === undefined || writeFile === undefined || rename === undefined) {
		if (environment === 'node') {
			const fs = await import('node:fs/promises')
			readFile = async (filePath) => fs.readFile(filePath, 'utf8')
			writeFile = async (filePath, data) => fs.writeFile(filePath, data, 'utf8')
			rename = async (oldPath, newPath) => fs.rename(oldPath, newPath)
		} else {
			throw new Error(
				'The "readFile", "writeFile", and "rename" file function implementations must be provided to the function when running in the browser',
			)
		}
	}

	return { readFile, rename, writeFile }
}

export function getSafeAnkiMediaFilename(absoluteFilePath: string, namespace: string): string {
	// Anki truncates long file names... so we crush the complete path down to a hash
	// Taking the actual hash of the asset would make isomorphism more of a pain, and Anki might do some hash comparison of its own?
	const fileExtension = path.extname(absoluteFilePath)
	const namespaceHash = getNamespaceHash(namespace)
	const fileNameHash = getHash(
		`${path.dirname(absoluteFilePath)}${path.basename(absoluteFilePath)}`,
		8,
	)
	const fileNameLegible =
		`${slugify(path.basename(absoluteFilePath, fileExtension).trim()).slice(0, 60)}`.replace(
			/-+$/,
			'',
		)
	const safeFilename = `${namespaceHash}-${fileNameHash}-${fileNameLegible}${fileExtension}`

	// Should never happen
	// Observed max length in Anki seems to be 115... we leave some breathing room
	if (safeFilename.length > 100) {
		throw new Error(`Filename too long: ${safeFilename}`)
	}

	return safeFilename
}

export function isUrl(filePath: string): boolean {
	return filePath.startsWith('http://') || filePath.startsWith('https://')
}

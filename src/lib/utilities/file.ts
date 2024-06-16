import { environment } from './platform'

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

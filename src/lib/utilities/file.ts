import type { FileAdapters } from '../shared/types'
import { getHash } from './string'

export async function getFileContentHash(
	absoluteFilePath: string,
	fileAdapters: FileAdapters,
): Promise<string> {
	const { ctimeMs, mtimeMs, size } = await fileAdapters.stat(absoluteFilePath)
	// TODO do a real hash of the actual content? Worried about performance.

	return getHash(`${ctimeMs}${mtimeMs}${size}`, 16)
}

import { type syncFiles } from '../../src/lib'
import os from 'node:os'
import sortKeys from 'sort-keys'

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

export function cleanUpTempPath(filePath: string | undefined): string | undefined {
	if (filePath === undefined) {
		return undefined
	}

	return filePath.replace(os.tmpdir(), '/').replace(/\/\d{13}\//, '')
}

type SyncResults = UnwrapPromise<ReturnType<typeof syncFiles>>
export function stableResults(results: SyncResults): SyncResults {
	results.duration = 0
	results.synced = results.synced.map((note) => {
		note.filePath = cleanUpTempPath(note.filePath)
		note.filePathOriginal = cleanUpTempPath(note.filePathOriginal)
		note.note.noteId = 0
		return note
	})

	return sortKeys(results, { deep: true })
}

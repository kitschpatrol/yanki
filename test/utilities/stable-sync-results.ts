import { type syncFiles } from '../../src/lib'
import path from 'node:path'
import sortKeys from 'sort-keys'

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

type SyncResults = UnwrapPromise<ReturnType<typeof syncFiles>>
export function stableResults(results: SyncResults): SyncResults {
	results.duration = 0
	results.synced = results.synced.map((note) => {
		note.filePath = path.basename(note.filePath)
		note.note.noteId = 0
		return note
	})

	return sortKeys(results, { deep: true })
}

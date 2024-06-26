import { type syncFiles } from '../../src/lib'
import os from 'node:os'
import slash from 'slash'
import sortKeys from 'sort-keys'

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

export function stablePrettyMs(text: string): string {
	return text.replaceAll(/\s\d+[ms]+/g, ' XXX')
}

export function sortMultiline(text: string): string {
	return text.split('\n').sort().join('\n')
}

export function cleanUpTempPath(filePath: string | undefined): string | undefined {
	if (filePath === undefined) {
		return undefined
	}

	return filePath.replaceAll(slash(os.tmpdir()), '/').replaceAll(/\/\d{13}\//g, '')
}

function cleanUpHashes(text: string): string {
	return text.replaceAll(/-[\da-f]{16}-/g, '-HASH-')
}

export function stableNoteIds(text: string): string {
	return text.replaceAll(/\d{13}/g, 'XXXXXXXXXXXXX')
}

type SyncResults = UnwrapPromise<ReturnType<typeof syncFiles>>
export function stableResults(results: SyncResults): SyncResults {
	results.duration = 0
	results.synced = results.synced.map((note) => {
		note.filePath = cleanUpTempPath(note.filePath)
		note.filePathOriginal = cleanUpTempPath(note.filePathOriginal)
		note.note.noteId = 0
		note.note.fields.Front = cleanUpHashes(cleanUpTempPath(note.note.fields.Front) ?? '')
		note.note.fields.Back = cleanUpHashes(cleanUpTempPath(note.note.fields.Back) ?? '')
		return note
	})

	return sortKeys(results, { deep: true })
}

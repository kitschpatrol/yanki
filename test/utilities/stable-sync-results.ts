/* eslint-disable jsdoc/require-jsdoc */

import os from 'node:os'
import sortKeys from 'sort-keys'
import { type syncFiles } from '../../src/lib'
import { normalize } from '../../src/lib/utilities/path'

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

export function stablePrettyMs(text: string): string {
	return text.replaceAll(/\s[\d.]+[ms]+/g, ' XXX')
}

export function sortMultiline(text: string): string {
	return text.split('\n').sort().join('\n')
}

export function cleanUpTempPath(filePath: string | undefined): string | undefined {
	if (filePath === undefined) {
		return undefined
	}

	return filePath.replaceAll(normalize(os.tmpdir()), '/').replaceAll(/\/\d{13}\//g, '')
}

function stripNewlines(input: string): string {
	// eslint-disable-next-line regexp/no-unused-capturing-group
	return input.replaceAll(/(\r\n|\n|\r)/g, '')
}

function cleanUpHashes(text: string): string {
	return text.replaceAll(/-[\da-f]{16}/g, '-HASH')
}

export function stableNoteIds(text: string): string {
	return text.replaceAll(/\d{13}/g, 'XXXXXXXXXXXXX')
}

type SyncResults = UnwrapPromise<ReturnType<typeof syncFiles>>
export function stableResults(results: SyncResults): SyncResults {
	results.duration = 0
	results.synced = results.synced.map((note) => {
		note.filePath = cleanUpTempPath(note.filePath)

		// Different Unicode paths normalization on Windows vs. Mac...
		note.filePathOriginal = cleanUpTempPath(note.filePathOriginal)?.normalize('NFC')

		note.note.noteId = 0

		if (note.note.cards !== undefined) {
			note.note.cards = note.note.cards.map(() => 0)
		}

		note.note.fields.Front = stripNewlines(
			cleanUpHashes(cleanUpTempPath(note.note.fields.Front) ?? ''),
		)
		note.note.fields.Back = stripNewlines(
			cleanUpHashes(cleanUpTempPath(note.note.fields.Back) ?? ''),
		)

		return note
	})

	let sorted: SyncResults

	try {
		sorted = sortKeys(results, { deep: true })
	} catch {
		console.log(`Problem sorting keys!`)
		sorted = results
	}

	// Extra sorting after seeing some cross-platform differences
	sorted.deletedDecks = sorted.deletedDecks.sort()
	sorted.deletedMedia = sorted.deletedMedia.sort()
	sorted.synced = sorted.synced.sort((a, b) => {
		// Glue everything together...
		const aString = a.note.deckName + a.note.fields.Front + a.note.fields.Back
		const bString = b.note.deckName + b.note.fields.Front + b.note.fields.Back
		return aString.localeCompare(bString)
	})

	return sorted
}

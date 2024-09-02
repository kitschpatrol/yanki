import { type YankiNote } from '../model/note'
import { getFirstLineOfHtmlAsPlainText } from '../parse/rehype-utilities'
import {
	MEDIA_DEFAULT_EMPTY_FILENAME,
	MEDIA_FILENAME_MAX_LENGTH,
	NOTE_DEFAULT_EMPTY_TEXT,
} from '../shared/constants'
import type { ManageFilenames } from '../shared/types'
import { emptyIsUndefined, truncateOnWordBoundary } from './string'
import filenamify from 'filenamify'
import { nanoid } from 'nanoid'
import path from 'path-browserify-esm'

// eslint-disable-next-line complexity
export function getSafeTitleForNote(
	note: YankiNote,
	manageFilenames: ManageFilenames,
	maxLength: number,
): string {
	if (manageFilenames === 'off') {
		throw new Error('manageFilenames must not be off')
	}

	switch (note.modelName) {
		case 'Yanki - Basic':
		case 'Yanki - Basic (and reversed card with extra)':
		case 'Yanki - Basic (type in the answer)': {
			const cleanFront = emptyIsUndefined(
				getSafeFilename(note.fields.Front) // Truncated later!
					.replace(NOTE_DEFAULT_EMPTY_TEXT, '')
					.replace(MEDIA_DEFAULT_EMPTY_FILENAME, ''),
			)
			const cleanBack = emptyIsUndefined(
				getSafeFilename(note.fields.Back) // Truncated later!
					.replace(NOTE_DEFAULT_EMPTY_TEXT, '')
					.replace(MEDIA_DEFAULT_EMPTY_FILENAME, ''),
			)

			// Always try to provide some semantic value
			switch (manageFilenames) {
				case 'prompt': {
					return getSafeFilename(cleanFront ?? cleanBack ?? '', maxLength)
				}

				case 'response': {
					return getSafeFilename(cleanBack ?? cleanFront ?? '', maxLength)
				}
			}
		}

		// eslint-disable-next-line no-fallthrough
		case 'Yanki - Cloze': {
			const cleanFront = emptyIsUndefined(
				getSafeFilename(note.fields.Front)
					.replace(NOTE_DEFAULT_EMPTY_TEXT, '')
					.replace(MEDIA_DEFAULT_EMPTY_FILENAME, ''),
			)

			if (cleanFront === undefined) {
				// Should never happen
				return getSafeFilename('', maxLength)
			}

			const textBeforeCloze = emptyIsUndefined(cleanFront.split('{{').at(0) ?? '')
			const firstClozeText = emptyIsUndefined(/{{\w\d*::([^:}]+)/.exec(cleanFront)?.at(0))
			const textAfterCloze = emptyIsUndefined(cleanFront.split('}}').at(1)?.split('{{').at(0) ?? '')

			// Always try to provide some semantic value
			switch (manageFilenames) {
				case 'prompt': {
					return getSafeFilename(
						textBeforeCloze ?? textAfterCloze ?? firstClozeText ?? '',
						maxLength,
					)
				}

				case 'response': {
					return getSafeFilename(
						firstClozeText ?? textBeforeCloze ?? textAfterCloze ?? '',
						maxLength,
					)
				}
			}
		}

		// No default
	}
}

/**
 *
 * @param text
 * @param maxLength If undefined, no truncation will take place. If defined, a maximum maximum length of the filename will be enforced.
 * @returns
 */
function getSafeFilename(text: string, maxLength?: number | undefined): string {
	let basicSafeFilename = filenamify(getFirstLineOfHtmlAsPlainText(text).trim(), {
		maxLength: Number.MAX_SAFE_INTEGER,
		replacement: ' ',
	})
		.replaceAll(/\s+/g, ' ')
		.trim()

	// Edge case where the filename is empty
	if (basicSafeFilename.length === 0) {
		basicSafeFilename = MEDIA_DEFAULT_EMPTY_FILENAME
	}

	// Unicode normalization
	// https://github.com/kitschpatrol/yanki-obsidian/issues/13
	basicSafeFilename = basicSafeFilename.normalize('NFC')

	if (maxLength === undefined) {
		return basicSafeFilename
	}

	// Use yanki's max media filename as an upper limit
	// 3 `.md`, 9 for increment (temporarily 8 character nanoid + dot)
	// truncateOnWordBoundary factors ellipses
	const safeMaxLength = Math.min(maxLength, MEDIA_FILENAME_MAX_LENGTH - (3 + 9))
	return truncateOnWordBoundary(basicSafeFilename, safeMaxLength)
}

// Always prefixes with increment! Cleaned up in a subsequent pass.
export function getUniqueFilePath(filePath: string, existingFilenames: string[]): string {
	let newFilePath = appendFilenameIncrement(filePath, 1)
	let increment = 2
	while (existingFilenames.includes(newFilePath.toLowerCase())) {
		newFilePath = appendFilenameIncrement(filePath, increment)
		increment++
	}

	return newFilePath
}

// If there is no "second file", then strip the (1) suffix
export function auditUniqueFilePath(filePath: string, existingFilenames: string[]) {
	const testPath = appendFilenameIncrement(filePath, 2)

	if (existingFilenames.includes(testPath.toLowerCase())) {
		return filePath
	}

	return stripFilenameIncrement(filePath)
}

/**
 * @param filename File name with or without an extension, and possibly with a (1)
 * @returns filename without the increment
 */
function stripFilenameIncrement(filename: string): string {
	// Don't mistake '... (1)' suffixes for extensions
	// TODO make this less precarious
	const validExtension =
		filename.endsWith('.') || filename.endsWith(')') ? undefined : path.extname(filename)

	const strippedBaseNameWithoutExtension = path
		.basename(filename, validExtension)
		.replace(/\s\(\d+\)$/, '')
	return path.join(
		path.dirname(filename),
		`${strippedBaseNameWithoutExtension}${validExtension ?? ''}`,
	)
}

function appendFilenameIncrement(filename: string, value: number): string {
	const extension = path.extname(filename)
	const baseNameWithoutExtension = path.basename(filename, extension)

	const baseNameWithIncrement = `${stripFilenameIncrement(baseNameWithoutExtension)} (${value})`

	return path.join(path.dirname(filename), `${baseNameWithIncrement}${extension}`)
}

export function getTemporarilyUniqueFilePath(filePath: string): string {
	return `${filePath}-${nanoid(8)}`
}

// Not needed
// export function stripTemporarilyUniqueFilePath(filePath: string): string {
// 	return filePath.slice(0, -9)
// }

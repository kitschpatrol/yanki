import { yankiDefaultEmptyNotePlaceholderText } from '../model/constants'
import { type YankiNote } from '../model/note'
import { emptyIsUndefined, stripHtmlTags, truncateWithEllipsis } from './string'
import filenamify from 'filenamify'
import { nanoid } from 'nanoid'
import path from 'path-browserify-esm'

export const defaultEmptyFilenamePlaceholderText = 'Untitled'

export function getSafeTitleForNote(
	note: YankiNote,
	mode: 'prompt' | 'response',
	maxLength: number,
): string {
	switch (note.modelName) {
		case 'Yanki - Basic':
		case 'Yanki - Basic (and reversed card)':
		case 'Yanki - Basic (type in the answer)': {
			const cleanFront = emptyIsUndefined(
				getSafeFilename(note.fields.Front)
					.replace(yankiDefaultEmptyNotePlaceholderText, '')
					.replace(defaultEmptyFilenamePlaceholderText, ''),
			)
			const cleanBack = emptyIsUndefined(
				getSafeFilename(note.fields.Back)
					.replace(yankiDefaultEmptyNotePlaceholderText, '')
					.replace(defaultEmptyFilenamePlaceholderText, ''),
			)

			// Always try to provide some semantic value
			switch (mode) {
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
					.replace(yankiDefaultEmptyNotePlaceholderText, '')
					.replace(defaultEmptyFilenamePlaceholderText, ''),
			)

			if (cleanFront === undefined) {
				// Should never happen
				return getSafeFilename('', maxLength)
			}

			const textBeforeCloze = emptyIsUndefined(cleanFront.split('{{')[0])
			const firstClozeText = emptyIsUndefined(/{{\w\d*::([^:}]+)/.exec(cleanFront)?.at(0))
			const textAfterCloze = emptyIsUndefined(cleanFront.split('}}')[1].split('{{')[0])

			// Always try to provide some semantic value
			switch (mode) {
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
	let basicSafeFilename = filenamify(stripHtmlTags(text).trim(), {
		maxLength: Number.MAX_SAFE_INTEGER,
		replacement: ' ',
	})
		.replaceAll(/\s+/g, ' ')
		.trim()

	// Edge case where the filename is empty
	if (basicSafeFilename.length === 0) {
		basicSafeFilename = defaultEmptyFilenamePlaceholderText
	}

	if (maxLength === undefined) {
		return basicSafeFilename
	}

	const safeMaxLength = Math.min(maxLength, 255 - (5 + 3 + 9)) // 5 for extension and dot, 3 for ellipsis, 9 for increment
	return truncateWithEllipsis(basicSafeFilename, safeMaxLength)
}

export function getUniqueFilePath(filePath: string, existingFilenames: string[]): string {
	let newFilePath = filePath
	let increment = 1
	while (existingFilenames.includes(newFilePath)) {
		newFilePath = appendFilenameIncrement(filePath, increment)
		increment++
	}

	return newFilePath
}

/**
 * @param filename File name without extension, but possible with an (1)
 * @returns filename without the increment
 */
function stripFilenameIncrement(filename: string): string {
	return filename.replace(/\s\(\d+\)$/, '')
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

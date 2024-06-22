import { yankiDefaultEmptyNotePlaceholderText } from '../model/constants'
import { type YankiNote } from '../model/note'
import { getFirstLineOfHtmlAsPlainText } from '../parse/rehype-utilities'
import type { ManageFilenames } from '../shared/types'
import { emptyIsUndefined, truncateWithEllipsis } from './string'
import filenamify from 'filenamify'
import { nanoid } from 'nanoid'
import path from 'path-browserify-esm'

export const defaultEmptyFilenamePlaceholderText = 'Untitled'

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
					.replace(yankiDefaultEmptyNotePlaceholderText, '')
					.replace(defaultEmptyFilenamePlaceholderText, ''),
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
		basicSafeFilename = defaultEmptyFilenamePlaceholderText
	}

	if (maxLength === undefined) {
		return basicSafeFilename
	}

	const safeMaxLength = Math.min(maxLength, 255 - (5 + 3 + 9)) // 5 for extension and dot, 3 for ellipsis, 9 for increment
	return truncateWithEllipsis(basicSafeFilename, safeMaxLength)
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
 * @param filename File name without extension, but possible with an (1)
 * @returns filename without the increment
 */
function stripFilenameIncrement(filename: string): string {
	const extension = path.extname(filename)
	const strippedBaseNameWithoutExtension = path
		.basename(filename, extension)
		.replace(/\s\(\d+\)$/, '')
	return path.join(path.dirname(filename), `${strippedBaseNameWithoutExtension}${extension}`)
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

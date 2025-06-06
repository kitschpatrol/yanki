import { parse as yamlParse, stringify as yamlStringify } from 'yaml'

export type Frontmatter = {
	deckName?: string
	noteId?: number
	tags?: string | string[]
}

/**
 * Update the noteId in the frontmatter of a markdown string.
 *
 * Used when a noteId is received from Anki after creating a note.
 *
 *
 * String manipulation is ugly, but it ensures that the markdown format is
 * preserved verbatim. Running it through the unified AST and then
 * remarkStringify would possibly change the format.
 * @param markdown Raw markdown string with frontmatter.
 * @param noteId  The value to set the noteId to. If undefined, the noteId will
 * be removed from the frontmatter. (Useful for testing.) @returns Raw markdown
 * string with updated frontmatter.
 */
export async function setNoteIdInFrontmatter(
	markdown: string,
	noteId: number | undefined,
): Promise<string> {
	const [frontmatterStart, frontmatterEnd] = getFrontmatterRange(markdown)

	const lines = markdown.split(/\r?\n/)

	if (frontmatterStart === undefined || frontmatterEnd === undefined) {
		// No frontmatter if no noteId is provided
		if (noteId === undefined) {
			return markdown
		}

		// Add frontmatter with noteID
		const newFrontmatter = yamlStringify({ noteId }).trim()

		return ['---', newFrontmatter, '---\n', ...lines].join('\n')
	}

	const frontmatter = lines.slice(frontmatterStart + 1, frontmatterEnd).join('\n')
	const parsedFrontmatter = ((await yamlParse(frontmatter)) ?? {}) as Record<string, unknown>

	if (noteId === undefined) {
		delete parsedFrontmatter.noteId

		// Remove the frontmatter if it's empty after removing the noteId
		if (Object.keys(parsedFrontmatter).length === 0) {
			// Return markdown without frontmatter, trimming a single empty leading line if present
			const markdownWithoutFrontmatter = lines.slice(frontmatterEnd + 1)

			// Strip leading empty line if present
			// (This is a common artifact of formatting Markdown files with frontmatter)
			if (markdownWithoutFrontmatter[0].trim() === '') {
				return markdownWithoutFrontmatter.slice(1).join('\n')
			}

			return markdownWithoutFrontmatter.join('\n')
		}
	} else {
		parsedFrontmatter.noteId = noteId
	}

	const newFrontmatter = yamlStringify(parsedFrontmatter, {
		lineWidth: 0,
	}).trim()

	return [
		...lines.slice(0, frontmatterStart + 1),
		newFrontmatter,
		...lines.slice(frontmatterEnd),
	].join('\n')
}

function getFrontmatterRange(
	markdown: string,
): [start: number | undefined, end: number | undefined] {
	const lines = markdown.split(/\r?\n/)

	// Ensure that the frontmatter is at the top of the file
	if (!lines.join('').trim().startsWith('---')) {
		return [undefined, undefined]
	}

	const frontmatterStart = lines.findIndex((line) => line.startsWith('---'))
	const frontmatterEnd = lines.findIndex(
		(line, index) => index > frontmatterStart && line.startsWith('---'),
	)

	if (frontmatterStart === -1 || frontmatterEnd === -1) {
		return [undefined, undefined]
	}

	return [frontmatterStart, frontmatterEnd]
}

/**
 * Currently used in testing only.
 * @returns All frontmatter in the markdown as an object, or an empty object if no frontmatter is found.
 */
export async function getAllFrontmatter(markdown: string): Promise<Record<string, unknown>> {
	const [frontmatterStart, frontmatterEnd] = getFrontmatterRange(markdown)

	if (frontmatterStart === undefined || frontmatterEnd === undefined) {
		return {}
	}

	// TODO rejoin with same ending...
	const frontmatter = markdown
		.split(/\r?\n/)
		.slice(frontmatterStart + 1, frontmatterEnd)
		.join('\n')

	return ((await yamlParse(frontmatter)) ?? {}) as Record<string, unknown>
}

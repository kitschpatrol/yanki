import { parse as yamlParse, stringify as yamlStringify } from 'yaml'

export type Frontmatter = {
	deckName?: string
	noteId?: number
	tags?: string[]
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
 *
 * @param markdown Raw markdown string with frontmatter.
 * @param noteId  The value to set the noteId to. If undefined, the noteId will
 * be removed from the frontmatter. (Useful for testing.) @returns Raw markdown
 * string with updated frontmatter.
 */
export async function setNoteIdInFrontmatter(
	markdown: string,
	noteId: number | undefined,
): Promise<string> {
	const lines = markdown.split('\n')
	const frontmatterStart = lines.findIndex((line) => line.startsWith('---'))
	const frontmatterEnd = lines.findIndex(
		(line, index) => index > frontmatterStart && line.startsWith('---'),
	)

	if (frontmatterStart === -1 || frontmatterEnd === -1) {
		// No nothing if no noteId is provided
		if (noteId === undefined) {
			return markdown
		}

		// Add frontmatter with noteID
		const newFrontmatter = yamlStringify({ noteId }).trim()
		return ['---', newFrontmatter, '---\n', ...lines].join('\n')
	}

	const frontmatter = lines.slice(frontmatterStart + 1, frontmatterEnd).join('\n')
	const parsedFrontmatter = ((await yamlParse(frontmatter)) ?? {}) as Frontmatter

	if (noteId === undefined) {
		delete parsedFrontmatter.noteId
	} else {
		parsedFrontmatter.noteId = noteId
	}

	const newFrontmatter = yamlStringify(parsedFrontmatter).trim()

	return [
		...lines.slice(0, frontmatterStart + 1),
		newFrontmatter,
		...lines.slice(frontmatterEnd),
	].join('\n')
}

import type { AnkiNote } from '../types/anki-note'
import {
	deleteFirstNodeOfType,
	getAnkiNoteTypeFromTree,
	getAstFromMarkdown,
	replaceDeleteNodesWithClozeMarkup,
	splitTreeAtEmphasis,
	splitTreeAtThematicBreak,
} from './ast-utilities'
import { getFrontmatterFromTree } from './frontmatter'
import remarkHtml from 'remark-html'
import { unified } from 'unified'

export async function getAnkiJsonFromMarkdown(markdown: string): Promise<AnkiNote> {
	let ast = await getAstFromMarkdown(markdown)
	const noteType = getAnkiNoteTypeFromTree(ast)
	const frontmatter = getFrontmatterFromTree(ast)

	// Remove the frontmatter from the AST
	ast = deleteFirstNodeOfType(ast, 'yaml')

	let frontValue = ''
	let backValue = ''

	switch (noteType) {
		case 'Basic':
		case 'Basic (and reversed card)': {
			const [firstPart, secondPart] = splitTreeAtThematicBreak(ast)
			frontValue = unified().use(remarkHtml).stringify(firstPart)
			backValue =
				secondPart === undefined
					? '<p><em>Intentionally blank.</em></p>\n'
					: unified().use(remarkHtml).stringify(secondPart)

			break
		}

		case 'Cloze': {
			ast = replaceDeleteNodesWithClozeMarkup(ast)
			frontValue = unified().use(remarkHtml).stringify(ast)
			backValue = ''
			break
		}

		case 'Basic (type in the answer)': {
			const [firstPart, secondPart] = splitTreeAtEmphasis(ast)
			frontValue = unified().use(remarkHtml).stringify(firstPart)
			backValue = secondPart
			break
		}
		// No default
	}

	const note: AnkiNote = {
		deck: frontmatter.deck ?? 'Default',
		fields: {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			Back: {
				order: 1,
				value: backValue,
			},
			// eslint-disable-next-line @typescript-eslint/naming-convention
			Front: {
				order: 0,
				value: frontValue,
			},
		},
		modelName: noteType,
		noteId: frontmatter.id ?? undefined,
		tags: frontmatter.tags ?? [],
	}

	return note
}

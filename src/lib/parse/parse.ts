/**
 * Turns a markdown string into a YankiNote object.
 */

import { type YankiNote } from '../model/yanki-note'
import { mdastToHtml } from './rehype-utilities'
import {
	type AstFromMarkdownOptions,
	deleteFirstNodeOfType,
	getAstFromMarkdown,
	getFrontmatterFromTree,
	getYankiModelNameFromTree,
	replaceDeleteNodesWithClozeMarkup,
	splitTreeAtEmphasis,
	splitTreeAtThematicBreak,
} from './remark-utilities'

export type NoteFromMarkdownOptions = {
	namespace: string
} & AstFromMarkdownOptions

export async function getNoteFromMarkdown(
	markdown: string,
	options: NoteFromMarkdownOptions,
): Promise<YankiNote> {
	const { namespace, obsidianVault } = options

	// Anki won't create notes if the front field is blank, but we want
	// parity between markdown files and notes at all costs, so we'll put
	// in a placeholder if the front is empty.
	const emptyNotePlaceholder = '<p><em>(Empty)</em></p>'

	let ast = await getAstFromMarkdown(markdown, {
		obsidianVault,
	})
	const modelName = getYankiModelNameFromTree(ast)
	const frontmatter = getFrontmatterFromTree(ast)

	// Remove the frontmatter from the AST
	ast = deleteFirstNodeOfType(ast, 'yaml')

	let front = ''
	let back = ''

	switch (modelName) {
		case `Yanki - Basic`:
		case `Yanki - Basic (and reversed card)`: {
			const [firstPart, secondPart] = splitTreeAtThematicBreak(ast)

			// Anki won't create notes if the front field is blank, but we want parity between markdown files and notes at all costs,
			// so we'll put in a placeholder if the front is empty.
			const frontHtml = await mdastToHtml(firstPart)
			front = frontHtml.length === 0 ? emptyNotePlaceholder : frontHtml
			back = await mdastToHtml(secondPart)
			break
		}

		case `Yanki - Cloze`: {
			ast = replaceDeleteNodesWithClozeMarkup(ast)
			const [firstPart, secondPart] = splitTreeAtThematicBreak(ast)

			const frontHtml = await mdastToHtml(firstPart)
			front = frontHtml.length === 0 ? emptyNotePlaceholder : frontHtml

			back = await mdastToHtml(secondPart)
			break
		}

		case `Yanki - Basic (type in the answer)`: {
			const [firstPart, secondPart] = splitTreeAtEmphasis(ast)

			const frontHtml = await mdastToHtml(firstPart)
			front = frontHtml.length === 0 ? emptyNotePlaceholder : frontHtml

			back = secondPart
			break
		}
	}

	const note: YankiNote = {
		deckName: frontmatter.deckName ?? '', // Set later based on file path if undefined
		fields: {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			Back: back,
			// eslint-disable-next-line @typescript-eslint/naming-convention
			Front: front,
			// eslint-disable-next-line @typescript-eslint/naming-convention
			YankiNamespace: namespace,
		},
		modelName,
		noteId: frontmatter.noteId ?? undefined,
		tags: frontmatter.tags ?? [],
	}

	return note
}

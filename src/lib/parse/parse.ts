/**
 * Turns a markdown string into a YankiNote object.
 */

import { type YankiNote } from '../model/yanki-note'
import { mdastToHtml } from './rehype-utilities'
import {
	deleteFirstNodeOfType,
	getAstFromMarkdown,
	getFrontmatterFromTree,
	getYankiModelNameFromTree,
	replaceDeleteNodesWithClozeMarkup,
	splitTreeAtEmphasis,
	splitTreeAtThematicBreak,
} from './remark-utilities'

export async function getNoteFromMarkdown(markdown: string, namespace: string): Promise<YankiNote> {
	let ast = await getAstFromMarkdown(markdown)
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
			front = await mdastToHtml(firstPart)
			back =
				secondPart === undefined
					? '<p><em>Intentionally blank.</em></p>\n'
					: await mdastToHtml(secondPart)
			break
		}

		case `Yanki - Cloze`: {
			ast = replaceDeleteNodesWithClozeMarkup(ast)
			const [firstPart, secondPart] = splitTreeAtThematicBreak(ast)
			front = await mdastToHtml(firstPart)
			back = secondPart === undefined ? '' : await mdastToHtml(secondPart)
			break
		}

		case `Yanki - Basic (type in the answer)`: {
			const [firstPart, secondPart] = splitTreeAtEmphasis(ast)
			front = await mdastToHtml(firstPart)
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

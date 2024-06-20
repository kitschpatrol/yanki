/**
 * Turns a markdown string into a YankiNote object.
 */

import { yankiDefaultCssClassName } from '../model/constants'
import { type YankiNote } from '../model/note'
import { mdastToHtml } from './rehype-utilities'
import {
	type AstFromMarkdownOptions,
	deleteFirstNodeOfType,
	getAstFromMarkdown,
	getFrontmatterFromTree,
	getYankiModelNameFromTree,
	removeLastEmphasis,
	replaceDeleteNodesWithClozeMarkup,
	splitTreeAtThematicBreak,
} from './remark-utilities'
import path from 'path-browserify-esm'
import { u } from 'unist-builder'

export type NoteFromMarkdownOptions = {
	/** Path containing the markdown, used to resolve relative links in the markdown */
	cwd?: string
	namespace: string
} & AstFromMarkdownOptions

export async function getNoteFromMarkdown(
	markdown: string,
	options: NoteFromMarkdownOptions,
): Promise<YankiNote> {
	const { cwd = path.process_cwd, namespace, obsidianVault } = options

	// Anki won't create notes at all if the front field is blank, but we want
	// parity between markdown files and notes at all costs, so we'll put
	// in a placeholder if the front is empty.
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
		case 'Yanki - Basic':
		case 'Yanki - Basic (and reversed card)': {
			const [firstPart, secondPart] = splitTreeAtThematicBreak(ast)

			// Anki won't create notes if the front field is blank, but we want parity between markdown files and notes at all costs,
			// so we'll put in a placeholder if the front is empty. It's hard to know if the output is really empty without rendering, due to invisible elements.

			// Basic and reverse always needs both sides to have content.
			// Basic can technically have no back , but it's confusing so we throw in the placeholder.
			front = await mdastToHtml(
				firstPart,
				[yankiDefaultCssClassName, `namespace-${namespace}`, 'front', `model-${modelName}`],
				true,
				cwd,
			)
			back = await mdastToHtml(
				secondPart,
				[yankiDefaultCssClassName, `namespace-${namespace}`, 'back', `model-${modelName}`],
				true,
				cwd,
			)

			break
		}

		case 'Yanki - Cloze': {
			ast = replaceDeleteNodesWithClozeMarkup(ast)
			const [firstPart, secondPart] = splitTreeAtThematicBreak(ast)

			// Cloze can't have empty front? But what does that even mean?
			front = await mdastToHtml(
				firstPart,
				[yankiDefaultCssClassName, `namespace-${namespace}`, 'front', `model-${modelName}`],
				true,
				cwd,
			)
			back = await mdastToHtml(
				secondPart,
				[yankiDefaultCssClassName, `namespace-${namespace}`, 'back', `model-${modelName}`],
				false,
				cwd,
			)

			break
		}

		case 'Yanki - Basic (type in the answer)': {
			// Mutates AST
			const secondPart = removeLastEmphasis(ast)

			if (secondPart === undefined) {
				throw new Error('Could not find emphasis in Basic (type in the answer) note AST.')
			}

			const firstPart = ast

			// Const [firstPart, secondPart] = splitTreeAtEmphasis(ast)
			// const secondPartHast = u('root', [u('paragraph', [u('text', secondPart)])])
			const secondPartHast = u('root', u('paragraph', secondPart.children))

			front = await mdastToHtml(
				firstPart,
				[yankiDefaultCssClassName, `namespace-${namespace}`, 'front', `model-${modelName}`],
				true,
				cwd,
			)

			// HTML in the "blank" seems to parse correctly in Anki, but appears as plain text
			back = await mdastToHtml(
				secondPartHast,
				[yankiDefaultCssClassName, `namespace-${namespace}`, 'back', `model-${modelName}`],
				false,
				cwd,
			)
			break
		}
	}

	const note: YankiNote = {
		// Disable the frontmatter deck name feature, just seems messy
		// deckName: frontmatter.deckName ?? '',
		deckName: '', // Set later based on file path if undefined
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

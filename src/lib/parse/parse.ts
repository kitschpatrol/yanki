/**
 * Turns a markdown string into a YankiNote object.
 */

import { type YankiNote } from '../model/note'
import { CSS_DEFAULT_CLASS_NAME } from '../shared/constants'
import {
	defaultGlobalOptions,
	getDefaultFetchAdapter,
	getDefaultFileAdapter,
} from '../shared/types'
import { type GlobalOptions } from '../shared/types'
import { validateAndSanitizeNamespace } from '../utilities/namespace'
import { mdastToHtml } from './rehype-utilities'
import {
	deleteFirstNodeOfType,
	getAstFromMarkdown,
	getFrontmatterFromTree,
	getYankiModelNameFromTree,
	removeLastEmphasis,
	replaceDeleteNodesWithClozeMarkup,
	splitTreeAtThematicBreak,
} from './remark-utilities'
import { deepmerge } from 'deepmerge-ts'
import { u } from 'unist-builder'

export type GetNoteFromMarkdownOptions = {
	/** Needed for the public API, but optional for more efficient use internally when the namespace is already validated. */
	namespaceValidationAndSanitization: boolean
} & Pick<
	GlobalOptions,
	'cwd' | 'fetchAdapter' | 'fileAdapter' | 'namespace' | 'obsidianVault' | 'syncMediaAssets'
>

export const defaultGetNoteFromMarkdownOptions: GetNoteFromMarkdownOptions = {
	namespaceValidationAndSanitization: true,
	...defaultGlobalOptions,
}

export async function getNoteFromMarkdown(
	markdown: string,
	options?: Partial<GetNoteFromMarkdownOptions>,
): Promise<YankiNote> {
	const {
		cwd,
		fetchAdapter = getDefaultFetchAdapter(),
		fileAdapter = await getDefaultFileAdapter(),
		namespace,
		namespaceValidationAndSanitization,
		obsidianVault,
		syncMediaAssets,
	} = deepmerge(defaultGetNoteFromMarkdownOptions, options ?? {})

	const sanitizedNamespace = namespaceValidationAndSanitization
		? validateAndSanitizeNamespace(namespace)
		: namespace

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
			front = await mdastToHtml(firstPart, {
				cssClassNames: [
					CSS_DEFAULT_CLASS_NAME,
					`namespace-${sanitizedNamespace}`,
					'front',
					`model-${modelName}`,
				],
				cwd,
				fetchAdapter,
				fileAdapter,
				namespace: sanitizedNamespace,
				syncMediaAssets,
				useEmptyPlaceholder: true,
			})
			back = await mdastToHtml(secondPart, {
				cssClassNames: [
					CSS_DEFAULT_CLASS_NAME,
					`namespace-${sanitizedNamespace}`,
					'back',
					`model-${modelName}`,
				],
				cwd,
				fetchAdapter,
				fileAdapter,
				namespace: sanitizedNamespace,
				syncMediaAssets,
				useEmptyPlaceholder: true,
			})

			break
		}

		case 'Yanki - Cloze': {
			ast = replaceDeleteNodesWithClozeMarkup(ast)
			const [firstPart, secondPart] = splitTreeAtThematicBreak(ast)

			// Cloze can't have empty front? But what does that even mean?
			front = await mdastToHtml(firstPart, {
				cssClassNames: [
					CSS_DEFAULT_CLASS_NAME,
					`namespace-${sanitizedNamespace}`,
					'front',
					`model-${modelName}`,
				],
				cwd,
				fetchAdapter,
				fileAdapter,
				namespace: sanitizedNamespace,
				syncMediaAssets,
				useEmptyPlaceholder: true,
			})
			back = await mdastToHtml(secondPart, {
				cssClassNames: [
					CSS_DEFAULT_CLASS_NAME,
					`namespace-${sanitizedNamespace}`,
					'back',
					`model-${modelName}`,
				],
				cwd,
				fetchAdapter,
				fileAdapter,
				namespace: sanitizedNamespace,
				syncMediaAssets,
				useEmptyPlaceholder: false,
			})

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

			front = await mdastToHtml(firstPart, {
				cssClassNames: [
					CSS_DEFAULT_CLASS_NAME,
					`namespace-${sanitizedNamespace}`,
					'front',
					`model-${modelName}`,
				],
				cwd,
				fetchAdapter,
				fileAdapter,
				namespace: sanitizedNamespace,
				syncMediaAssets,
				useEmptyPlaceholder: true,
			})

			// HTML in the "blank" seems to parse correctly in Anki, but appears as plain text
			back = await mdastToHtml(secondPartHast, {
				cssClassNames: [
					CSS_DEFAULT_CLASS_NAME,
					`namespace-${sanitizedNamespace}`,
					'back',
					`model-${modelName}`,
				],
				cwd,
				fetchAdapter,
				fileAdapter,
				namespace: sanitizedNamespace,
				syncMediaAssets,
				useEmptyPlaceholder: false,
			})
			break
		}
	}

	const note: YankiNote = {
		// Disable the frontmatter deck name feature, just seems messy
		// deckName: frontmatter.deckName ?? '',
		deckName: '', // Set later based on file path if undefined
		fields: {
			Back: back,
			Front: front,
			YankiNamespace: sanitizedNamespace,
		},
		modelName,
		noteId: frontmatter.noteId ?? undefined,
		tags: frontmatter.tags ?? [],
	}

	return note
}

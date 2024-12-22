/**
 * Turns a markdown string into a YankiNote object.
 */

import { deepmerge } from 'deepmerge-ts'
import { type Root } from 'mdast'
import { u } from 'unist-builder'
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

export type GetNoteFromMarkdownOptions = {
	/** Needed for the public API, but optional for more efficient use internally when the namespace is already validated. */
	namespaceValidationAndSanitization: boolean
} & Pick<
	GlobalOptions,
	| 'allFilePaths'
	| 'basePath'
	| 'cwd'
	| 'fetchAdapter'
	| 'fileAdapter'
	| 'namespace'
	| 'obsidianVault'
	| 'resolveUrls' // For testing only
	| 'strictLineBreaks'
	| 'syncMediaAssets'
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
		allFilePaths,
		basePath,
		cwd,
		fetchAdapter = getDefaultFetchAdapter(),
		fileAdapter = await getDefaultFileAdapter(),
		namespace,
		namespaceValidationAndSanitization,
		obsidianVault,
		resolveUrls,
		strictLineBreaks,
		syncMediaAssets,
	} = deepmerge(defaultGetNoteFromMarkdownOptions, options ?? {})

	const sanitizedNamespace = namespaceValidationAndSanitization
		? validateAndSanitizeNamespace(namespace)
		: namespace

	// Anki won't create notes at all if the front field is blank, but we want
	// parity between Markdown files and notes at all costs, so we'll put
	// in a placeholder if the front is empty.
	let ast = await getAstFromMarkdown(markdown, {
		allFilePaths,
		basePath,
		cwd,
		obsidianVault,
		resolveUrls,
	})
	const modelName = getYankiModelNameFromTree(ast)
	const frontmatter = getFrontmatterFromTree(ast)

	// Remove the frontmatter from the AST
	ast = deleteFirstNodeOfType(ast, 'yaml')

	let front = ''
	let back = ''
	let extra: string | undefined

	switch (modelName) {
		case 'Yanki - Basic':
		case 'Yanki - Basic (and reversed card with extra)': {
			let [firstPart, secondPart] = splitTreeAtThematicBreak(ast)
			let extraPart: Root | undefined

			// Check for extra in basic and reverse...
			if (
				secondPart !== undefined &&
				modelName === 'Yanki - Basic (and reversed card with extra)'
			) {
				// Must be defined even if content is non-existent
				extra = ''
				const [newSecondPart, newExtraPart] = splitTreeAtThematicBreak(secondPart)
				secondPart = newSecondPart
				extraPart = newExtraPart
			}

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
				fetchAdapter,
				fileAdapter,
				namespace: sanitizedNamespace,
				strictLineBreaks,
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
				fetchAdapter,
				fileAdapter,
				namespace: sanitizedNamespace,
				strictLineBreaks,
				syncMediaAssets,
				useEmptyPlaceholder: true,
			})

			if (extraPart !== undefined) {
				extra = await mdastToHtml(extraPart, {
					cssClassNames: [
						CSS_DEFAULT_CLASS_NAME,
						`namespace-${sanitizedNamespace}`,
						'extra',
						`model-${modelName}`,
					],
					fetchAdapter,
					fileAdapter,
					namespace: sanitizedNamespace,
					strictLineBreaks,
					syncMediaAssets,
					useEmptyPlaceholder: false,
				})
			}

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

				fetchAdapter,
				fileAdapter,
				namespace: sanitizedNamespace,
				strictLineBreaks,
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

				fetchAdapter,
				fileAdapter,
				namespace: sanitizedNamespace,
				strictLineBreaks,
				syncMediaAssets,
				useEmptyPlaceholder: false,
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

				fetchAdapter,
				fileAdapter,
				namespace: sanitizedNamespace,
				strictLineBreaks,
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

				fetchAdapter,
				fileAdapter,
				namespace: sanitizedNamespace,
				strictLineBreaks,
				syncMediaAssets,
				useEmptyPlaceholder: false,
			})

			break
		}
	}

	const note: YankiNote = {
		// Disable the frontmatter deck name feature, just seems messy
		// deckName: frontmatter.deckName ?? '',
		deckName: '', // Set later based on file path
		fields: {
			Back: back,
			...(extra !== undefined && { Extra: extra }),
			Front: front,
			YankiNamespace: sanitizedNamespace,
		},
		modelName,
		noteId: frontmatter.noteId ?? undefined,
		tags: obsidianTagsToAnkiTags(frontmatter.tags),
	}

	return note
}

function obsidianTagsToAnkiTags(tags: string | string[] | undefined): string[] {
	// Obsidian delimits nested tags with a `/`
	// Anki delimits nested tags with `::`
	// '\' and `:` are not permitted in Obsidian tags
	// Also convert single-string tags to array
	// Curiously, Obsidian allows just `/` and `this//////that` as valid tags, though `/` tags are broken.
	// Fixes https://github.com/kitschpatrol/yanki-obsidian/issues/20
	return (typeof tags === 'string' ? [tags] : (tags ?? [])).map((tag) => tag.replaceAll('/', '::'))
}

/**
 * Helpers for working with the Markdown AST.
 */

import type { Frontmatter } from '../model/frontmatter'
import type { YankiModelName } from '../model/yanki-note'
import remarkObsidianLink from './remark-obsidian-link'
import type { Node, Parent, Root, Text } from 'mdast'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkGithubBetaBlockquoteAdmonitions from 'remark-github-beta-blockquote-admonitions'
import remarkHtml from 'remark-html'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { u } from 'unist-builder'
import { CONTINUE, EXIT, visit } from 'unist-util-visit'
import { parse as yamlParse } from 'yaml'

// Processor shared across operations

export type AstFromMarkdownOptions = {
	obsidianVault?: string
}

export async function getAstFromMarkdown(
	markdown: string,
	options?: AstFromMarkdownOptions,
): Promise<Root> {
	const { obsidianVault } = options ?? {}

	const processor = unified()
		.use(remarkParse)
		.use(remarkMath)
		.use(remarkGfm)
		.use(remarkGithubBetaBlockquoteAdmonitions, {
			titleTextMap(title) {
				const bareTitle = title.slice(2, -1)
				const titleMap = {
					caution: '⚠️ Caution:',
					important: '❗ Important:',
					info: 'ℹ️ Info":',
					note: '✏️ Note:',
					tip: '💡 Tip:',
					warning: '⚠️ Warning:',
				}

				return {
					checkedTitle: bareTitle,
					displayTitle: titleMap[bareTitle.toLowerCase() as keyof typeof titleMap] ?? bareTitle,
				}
			},
		})
		.use(remarkFrontmatter, ['yaml'])
		.use(remarkObsidianLink, {
			toLink(wikiLink) {
				return {
					title: wikiLink.alias ?? wikiLink.value,
					uri: obsidianVault
						? `obsidian://open?vault=Vault&file=${encodeURIComponent(wikiLink.value)}.md`
						: wikiLink.value,
					value: wikiLink.alias ?? wikiLink.value,
				}
			},
		})

	return processor.run(processor.parse(markdown))
}

// Type guard to check if a node is a Text node
function isText(node: Node): node is Text {
	return node.type === 'text'
}

// Function to extract text from the first phrasing content node
export function extractTextFromNode(node: Parent): string | undefined {
	if (node.children.length > 0 && isText(node.children[0])) {
		return node.children[0].value
	}

	return undefined
}

export function deleteFirstNodeOfType(tree: Root, nodeType: string): Root {
	visit(tree, nodeType, (_, index, parent) => {
		if (parent && index !== undefined) {
			parent.children.splice(index, 1)
			return EXIT
		}
	})

	return tree
}

// For Cloze notes
export function replaceDeleteNodesWithClozeMarkup(ast: Root): Root {
	let clozeIndex = 1

	visit(ast, 'delete', (node, index, parent) => {
		if (parent === undefined || index === undefined) {
			return CONTINUE
		}

		// Render the children of the delete node as a string...
		const children = u('root', node.children)
		const innerText = unified().use(remarkHtml).stringify(children).trim()

		// Check for hints
		const matches = /(.+)(\(.+\)*)/g.exec(innerText)
		if (matches) {
			const [, text, hint] = matches
			const newNode = u('text', `{{c${clozeIndex}::${text.trim()}::${hint.trim()}}}`)
			parent.children.splice(index, 1, newNode)
		} else {
			const newNode = u('text', `{{c${clozeIndex}::${innerText}}}`)
			parent.children.splice(index, 1, newNode)
		}

		clozeIndex += 1
	})

	return ast
}

// For Basic (type in the answer) notes
export function splitTreeAtEmphasis(tree: Root): [Root, string] {
	let splitIndex: number | undefined
	let typeInText: string | undefined

	// Find the index of the last thematicBreak node
	visit(tree, 'emphasis', (node, index, parent) => {
		if (index === undefined || parent === undefined) {
			return CONTINUE
		}

		// Get index of parent
		const parentIndex = parent.children.indexOf(node)

		typeInText = extractTextFromNode(node)
		splitIndex = parentIndex
	})

	if (splitIndex === undefined) {
		throw new Error('Could not find emphasis in Basic (type in the answer) note AST.')
	}

	if (typeInText === undefined) {
		throw new Error('Could not find answer in Basic (type in the answer) note AST.')
	}

	// Split the tree at the found index
	const firstPart: Root = {
		children: tree.children.slice(0, splitIndex - 1),
		type: 'root',
	}

	return [firstPart, typeInText]
}

// For Basic and Basic (and reversed card) notes
export function splitTreeAtThematicBreak(tree: Root): [Root, Root | undefined] {
	let splitIndex: number | undefined
	let isDoubleBreak = false

	// Find the index of the first thematicBreak node
	visit(tree, 'thematicBreak', (_, index, parent) => {
		if (index === undefined || parent === undefined) {
			return CONTINUE
		}

		splitIndex = index

		// Check if next node is also a thematic break
		if (parent.children[index + 1]?.type === 'thematicBreak') {
			isDoubleBreak = true
		}

		return EXIT
	})

	if (splitIndex === undefined) {
		// Normal for cards without an answer... console.warn('Could not find
		// thematic break in Basic or Basic (and reversed card) note AST.')
		return [tree, undefined]
	}

	// Split the tree at the found index
	const firstPart: Root = {
		children: tree.children.slice(0, splitIndex),
		type: 'root',
	}

	const secondPart: Root = {
		children: tree.children.slice(splitIndex + (isDoubleBreak ? 2 : 1)),
		type: 'root',
	}

	return [firstPart, secondPart]
}

// Precedence: basic-type-in-the-answer > cloze > basic-and-reversed > basic If
// and of the sub-indicators are in the markdown, then the higher-precedence
// type wins If nothing matches, then we just get a basic note with all the
// markdown on the front, and nothing on the back
export function getYankiModelNameFromTree(ast: Root): YankiModelName {
	let probableType: YankiModelName | undefined

	// Cloze must come before thematic break
	visit(ast, (node) => {
		if (node.type === 'thematicBreak') {
			probableType = undefined
			return EXIT
		}

		if (node.type === 'delete') {
			probableType = `Yanki - Cloze`
			return EXIT
		}
	})
	if (probableType !== undefined) return probableType

	// Type in the answer must not have a thematic break at all, and the emphasis
	// must be the last node

	// Check last node type
	visit(ast.children.at(-1) as Parent, (node) => {
		if (node.type === 'emphasis') {
			probableType = `Yanki - Basic (type in the answer)`
		}
	})
	if (probableType !== undefined) return probableType

	// If we didn't find a signs of cloze or type in the answer, it must be a
	// basic card
	if (probableType === undefined) {
		let lastNode: Node | undefined
		visit(ast, 'thematicBreak', (node, index, parent) => {
			if (parent === null || index === null) return CONTINUE

			probableType =
				lastNode?.type === 'thematicBreak' && node.type === 'thematicBreak'
					? `Yanki - Basic (and reversed card)`
					: `Yanki - Basic`

			lastNode = node
		})
	}

	// Not noteworthy... if (probableType === undefined) { Console.warn('Could not
	// determine note type. Defaulting to basic.') }

	return probableType ?? `Yanki - Basic`
}

export function getFrontmatterFromTree(ast: Root): Frontmatter {
	let rawYaml: string | undefined
	visit(ast, 'yaml', (node) => {
		rawYaml = node.value
		return EXIT
	})

	if (rawYaml === undefined) {
		// Unremarkable
		// console.warn('No frontmatter found')
		return {}
	}

	return yamlParse(rawYaml) as Frontmatter
}

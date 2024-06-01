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
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { u } from 'unist-builder'
import { CONTINUE, EXIT, SKIP, visit } from 'unist-util-visit'
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

	// Not seeing huge improvements from reusing this...
	// And there's the issue of passing the options
	const processor = unified()
		.use(remarkParse)
		.use(remarkFrontmatter, [{ anywhere: false, marker: '-', type: 'yaml' }])
		.use(remarkGfm)
		.use(remarkMath)
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

		// If the last node is an emphasis node, we treat it as a hint
		const lastNode = node.children.at(-1)
		const clozeNodes =
			node.children.length > 1 && lastNode?.type === 'emphasis'
				? [
						u('text', `{{c${clozeIndex}::`),
						...node.children.slice(0, -1),
						u('text', '::'),
						...node.children.slice(-1),
						u('text', '}}'),
					]
				: [u('text', `{{c${clozeIndex}::`), ...node.children, u('text', '}}')]

		// Add the cloze markup around the kids
		parent.children.splice(index, 1, ...clozeNodes)

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
	// must be the last node, but it also must have more than one line

	// Walk for stats
	let thematicBreakCount = 0
	let emphasisCount = 0
	let contentElementCount = 0
	visit(ast, (node, index, parent) => {
		if (parent === null || index === null) {
			return CONTINUE
		}

		if (node.type === 'thematicBreak') {
			thematicBreakCount++
			return EXIT
		}

		if (node.type === 'emphasis') {
			emphasisCount++
			return SKIP
		}

		if (node.type === 'yaml') {
			return SKIP
		}

		if (isEmptyOrWhitespace(node)) {
			return CONTINUE
		}

		contentElementCount++
	})

	if (thematicBreakCount === 0 && emphasisCount >= 1 && contentElementCount >= 3) {
		return `Yanki - Basic (type in the answer)`
	}

	// If we didn't find a signs of cloze or type in the answer, it must be a
	// basic card
	let lastNode: Node | undefined
	visit(ast, 'thematicBreak', (node, index, parent) => {
		if (parent === null || index === null) return CONTINUE

		probableType =
			lastNode?.type === 'thematicBreak' && node.type === 'thematicBreak'
				? `Yanki - Basic (and reversed card)`
				: `Yanki - Basic`

		lastNode = node
	})

	// Not noteworthy... if (probableType === undefined) { Console.warn('Could not
	// determine note type. Defaulting to basic.') }

	return probableType ?? `Yanki - Basic`
}

// TODO not great edge cases
export function getFrontmatterFromTree(ast: Root): Frontmatter {
	let rawYaml: string | undefined
	visit(ast, 'yaml', (node) => {
		rawYaml = node.value
		return EXIT
	})

	if (!rawYaml) {
		// Unremarkable
		console.warn('No frontmatter found')
		return {}
	}

	const parsedYaml = yamlParse(rawYaml) as Frontmatter

	if (!parsedYaml) {
		throw new Error('Could not parse frontmatter')
	}

	return parsedYaml
}

// Utility function to check if a node is empty, whitespace, or a break
function isEmptyOrWhitespace(node: Node): boolean {
	if (node.type === 'break') {
		return true
	}

	if (node.type === 'text' && 'value' in node && typeof node.value === 'string') {
		return node.value.trim().length > 0
	}

	return false
}

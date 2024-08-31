// Helpers for working with the Markdown AST

import type { Frontmatter } from '../model/frontmatter'
import type { YankiModelName } from '../model/model'
import { type GlobalOptions, defaultGlobalOptions } from '../shared/types'
import remarkResolveLinks from './remark-resolve-links'
import remarkWikiBasic from './wiki-basic/remark-wiki-basic'
import { deepmerge } from 'deepmerge-ts'
import type { Emphasis, Node, Parent, PhrasingContent, Root, Text } from 'mdast'
import remarkFlexibleMarkers from 'remark-flexible-markers'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkGithubBetaBlockquoteAdmonitions from 'remark-github-beta-blockquote-admonitions'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { u } from 'unist-builder'
import { CONTINUE, EXIT, SKIP, visit } from 'unist-util-visit'
import { parse as yamlParse } from 'yaml'

export type AstFromMarkdownOptions = Pick<
	GlobalOptions,
	'allFilePaths' | 'basePath' | 'cwd' | 'obsidianVault' | 'resolveUrls'
>

export const defaultAstFromMarkdownOptions: AstFromMarkdownOptions = {
	...defaultGlobalOptions,
}

export async function getAstFromMarkdown(
	markdown: string,
	options?: Partial<AstFromMarkdownOptions>,
): Promise<Root> {
	const { allFilePaths, basePath, cwd, obsidianVault, resolveUrls } = deepmerge(
		defaultAstFromMarkdownOptions,
		options ?? {},
	)

	// Not seeing huge improvements from reusing this...
	// And there's the issue of passing the options
	const processor = unified()
		.use(remarkParse)
		.use(remarkFrontmatter, [{ anywhere: false, marker: '-', type: 'yaml' }])
		.use(remarkWikiBasic)
		.use(remarkGfm, { singleTilde: false })
		.use(remarkResolveLinks, { allFilePaths, basePath, cwd, enabled: resolveUrls, obsidianVault })
		.use(remarkMath)
		.use(
			remarkGithubBetaBlockquoteAdmonitions,
			// {
			// titleTextMap(title) {
			// 	const bareTitle = title.slice(2, -1)
			// 	const titleMap = {
			// 		caution: '⚠️ Caution:',
			// 		important: '❗ Important:',
			// 		info: 'ℹ️ Info":',
			// 		note: '✏️ Note:',
			// 		tip: '💡 Tip:',
			// 		warning: '⚠️ Warning:',
			// 	}
			// 	return {
			// 		checkedTitle: bareTitle,
			// 		displayTitle: titleMap[bareTitle.toLowerCase() as keyof typeof titleMap] ?? bareTitle,
			// 	}
			// },
			// }
		)
		// Highlights
		.use(remarkFlexibleMarkers)

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

/**
 * Trims all leading spaces from the first text node and all trailing spaces from
 * the last text node in an array of phrasing content nodes.
 *
 * This is useful in cases where surrounding white space in text nodes is not
 * necessary and should be removed to clean up the content.
 *
 * @param {PhrasingContent[]} nodes - An array of phrasing content nodes.
 * @returns {PhrasingContent[]} The modified array of nodes with leading and trailing spaces trimmed.
 */
function trimLeadingAndTrailingSpaces(nodes: PhrasingContent[]): PhrasingContent[] {
	// Trim leading spaces from the first text node
	const firstNode = nodes.at(0)
	if (firstNode?.type === 'text') {
		firstNode.value = firstNode.value.trimStart()
		if (firstNode.value === '') {
			nodes.shift() // Remove the first node if it's empty after trimming
		}
	}

	// Trim trailing spaces from the last text node
	const lastNode = nodes.at(-1)
	if (lastNode?.type === 'text') {
		lastNode.value = lastNode.value.trimEnd()
		if (lastNode.value === '') {
			nodes.pop() // Remove the last node if it's empty after trimming
		}
	}

	return nodes
}

// For Cloze notes
export function replaceDeleteNodesWithClozeMarkup(ast: Root): Root {
	let clozeIndex = 1

	visit(ast, 'delete', (node, index, parent) => {
		if (
			parent === undefined ||
			index === undefined ||
			!('children' in node) ||
			node.children.length === 0
		) {
			return CONTINUE
		}

		// If the first node is a text node with a number in it, we treat it as the
		// cloze number
		if (node.children.length > 0 && isText(node.children[0])) {
			// Detect a bunch of number variations at the start of the cloze
			const result = /^[(|]?(\d{1,2})(?:[\s).|]|$)(.*)$/g.exec(node.children[0].value)

			if (result !== null) {
				const possibleClozeIndex = Number.parseInt(result.at(1) ?? '', 10)

				if (!Number.isNaN(possibleClozeIndex)) {
					// Cloze index comes from the first node
					clozeIndex = possibleClozeIndex
					// Any leftovers become part of the cloze

					node.children[0].value =
						(result.at(2)?.trim().length ?? 0) > 0 ? (result.at(2) ?? '') : ''
				}
			}
		}

		// If the last node is an emphasis node, we treat it as a hint
		const lastNode = node.children.at(-1)
		const clozeNodes =
			node.children.length > 1 && lastNode?.type === 'emphasis'
				? [
						u('text', `{{c${clozeIndex}::`),
						...trimLeadingAndTrailingSpaces(node.children.slice(0, -1)),
						u('text', '::'),
						...trimLeadingAndTrailingSpaces(node.children.slice(-1)),
						u('text', '}}'),
					]
				: [
						u('text', `{{c${clozeIndex}::`),
						...trimLeadingAndTrailingSpaces(node.children),
						u('text', '}}'),
					]

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
		if (index === undefined || parent === undefined || !('children' in parent)) {
			return CONTINUE
		}

		// Get index of parent
		// TODO type issue
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
		const parentIndex = parent.children.indexOf(node as unknown as any)

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
		typeInText = extractTextFromNode(node as unknown as any)
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

// TODO return an object parsed into fields of MDAST instead?
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

	if (!hasThematicBreak(ast) && isLastVisibleNodeEmphasisWithOthers(ast)) {
		return `Yanki - Basic (type in the answer)`
	}

	// If we didn't find a signs of cloze or type in the answer, it must be a
	// basic card or a basic + reverse or a basic + reverse + extra
	// TODO next major: Don't traverse the tree, just look at the first level?
	let lastNode: Node | undefined
	visit(ast, (node, index, parent) => {
		if (parent === null || index === null) return CONTINUE

		if (node.type === 'thematicBreak') {
			// First thematic break means it could be basic
			if (probableType === undefined) {
				probableType = 'Yanki - Basic'
			}
			// Two thematic breaks in a row means  basic and reversed
			else if (probableType === 'Yanki - Basic' && lastNode?.type === 'thematicBreak') {
				probableType = 'Yanki - Basic (and reversed card with extra)'
				return EXIT
			}
		}

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
		if (!('value' in node)) {
			return CONTINUE
		}

		rawYaml = node.value
		return EXIT
	})

	if (!rawYaml) {
		// Unremarkable
		// console.warn('No frontmatter found')
		return {}
	}

	const parsedYaml = yamlParse(rawYaml) as Frontmatter

	if (!parsedYaml) {
		throw new Error('Could not parse frontmatter')
	}

	return parsedYaml
}

function hasThematicBreak(ast: Root): boolean {
	let hasThematicBreak = false

	visit(ast, 'thematicBreak', () => {
		hasThematicBreak = true
		return EXIT
	})

	return hasThematicBreak
}

function isLastVisibleNodeEmphasisWithOthers(ast: Root): boolean {
	let lastVisibleNode: (Emphasis | Text) | undefined
	let visibleCount = 0

	// Visit all nodes, tracking the last node with visible content and counting visible nodes
	visit(ast, (node) => {
		if (node.type === 'text' && node.value.trim() !== '') {
			lastVisibleNode = node
			visibleCount++ // Increment count for every visible node
		} else if (
			node.type === 'emphasis' &&
			// TODO type issue, PhrasingContent must be explicitly annotated for Rollup DTS plugin build...
			node.children.some(
				(child: PhrasingContent) => child.type === 'text' && child.value.trim() !== '',
			)
		) {
			lastVisibleNode = node
			visibleCount++ // Increment count for every visible node
			return SKIP
		}
	})

	return lastVisibleNode !== undefined && lastVisibleNode.type === 'emphasis' && visibleCount > 1
}

// Export function removeLastEmphasis(ast: Root): Emphasis | undefined {
// 	let lastEmphasisNode: Emphasis | undefined
// 	let lastEmphasisParent: Parent | undefined
// 	let lastEmphasisIndex: number | undefined
// 	let visibleCount = 0

// 	// Visit all nodes to track the last emphasis with visibility and count visible nodes
// 	visit(ast, (node, index, parent) => {
// 		if (parent === undefined || index === undefined) {
// 			return CONTINUE
// 		}

// 		if (node.type === 'text' && node.value.trim() !== '') {
// 			visibleCount++ // Increment for every visible text node
// 			lastEmphasisNode = undefined // Reset last emphasis if a visible text follows
// 		} else if (
// 			node.type === 'emphasis' &&
// 			node.children.some((child) => child.type === 'text' && child.value.trim() !== '')
// 		) {
// 			lastEmphasisNode = node
// 			lastEmphasisParent = parent
// 			lastEmphasisIndex = index
// 			visibleCount++ // Consider emphasis with visible text as visible
// 		}
// 	})

// 	// Remove the last emphasis node if it exists and there are other visible nodes
// 	if (
// 		lastEmphasisParent &&
// 		lastEmphasisNode &&
// 		typeof lastEmphasisIndex === 'number' &&
// 		visibleCount > 1
// 	) {
// 		lastEmphasisParent.children.splice(lastEmphasisIndex, 1)
// 		return lastEmphasisNode // Return the removed node
// 	}

// 	return undefined
// }

export function removeLastEmphasis(ast: Root): Emphasis | undefined {
	let lastEmphasisNode: Emphasis | undefined
	let lastEmphasisParent: Parent | undefined
	let lastEmphasisIndex: number | undefined

	// Visit all emphasis nodes and track the last one
	visit(ast, 'emphasis', (node, index, parent) => {
		if (parent === undefined || index === undefined || node.type !== 'emphasis') {
			return CONTINUE
		}

		lastEmphasisNode = node
		lastEmphasisParent = parent
		lastEmphasisIndex = index
	})

	// Remove the last emphasis node if it exists
	if (lastEmphasisParent && lastEmphasisNode && typeof lastEmphasisIndex === 'number') {
		lastEmphasisParent.children.splice(lastEmphasisIndex, 1)
		return lastEmphasisNode // Return the removed node
	}

	return undefined
}

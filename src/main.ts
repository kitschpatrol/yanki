// Import wikiLinkPlugin from '@portaljs/remark-wiki-link'
import remarkObsidianLink from '@kitschpatrol/remark-obsidian-link'
import type { Node, Parent, Root, Text } from 'mdast'
import fs from 'node:fs/promises'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { u } from 'unist-builder'
import { CONTINUE, EXIT, visit } from 'unist-util-visit'
import { parse as yamlParse } from 'yaml'

type NoteType = 'Basic (and reversed card)' | 'Basic (type in the answer)' | 'Basic' | 'Cloze'

type AnkiNote = {
	// Mdank specific
	deck: string
	fields: {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Back: {
			order: number
			value: string
		}
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Front: {
			order: number
			value: string
		}
	}
	modelName: NoteType
	noteId: number | undefined
	tags: string[]
	// Don't care
	// cards: number[]
}

type Frontmatter = {
	deck?: string
	id?: number
	tags?: string[]
}

function getFrontmatterFromTree(ast: Root): Frontmatter {
	let rawYaml: string | undefined
	visit(ast, 'yaml', (node) => {
		rawYaml = node.value
		return EXIT
	})

	if (rawYaml === undefined) {
		console.warn('No frontmatter found')
		return {}
	}

	return yamlParse(rawYaml) as Frontmatter
}

function replaceDeleteNodesWithClozeMarkup(ast: Root): Root {
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
			const newNode = u('text', `{{c1::${text.trim()}::${hint.trim()}}}`)
			parent.children.splice(index, 1, newNode)
		} else {
			const newNode = u('text', `{{c1::${innerText}}}`)
			parent.children.splice(index, 1, newNode)
		}
	})

	return ast
}

async function getAnkiJsonFromMarkdown(markdown: string): Promise<AnkiNote> {
	let ast = await getAstFromMarkdown(markdown)
	const noteType = getNoteTypeFromTree(ast)
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

	// Console.log(JSON.stringify(ast, undefined, 2))

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

// Type guard to check if a node is a Text node
function isText(node: Node): node is Text {
	return node.type === 'text'
}

// Function to extract text from the first phrasing content node
function extractTextFromNode(node: Parent): string | undefined {
	if (node.children.length > 0 && isText(node.children[0])) {
		return node.children[0].value
	}

	return undefined
}

function splitTreeAtEmphasis(tree: Root): [Root, string] {
	let splitIndex: number | undefined
	let typeInText: string | undefined = 'bla bla bla'

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
		throw new Error('Could not find thematic break in Basic or Basic (and reversed card) note AST.')
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

function splitTreeAtThematicBreak(tree: Root): [Root, Root | undefined] {
	let splitIndex: number | undefined
	let isDoubleBreak = false

	// Find the index of the first thematicBreak node
	visit(tree, 'thematicBreak', (node, index, parent) => {
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
		console.warn('Could not find thematic break in Basic or Basic (and reversed card) note AST.')
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

// Precedence: basic-and-reversed > basic > cloze > basic-type-in-the-answer
// If  and of the sub-indicators are in the markdown, then the higher-precedence type wins
// If nothing matches, then we just get a basic note with all the markdown on the front, and nothing on the back
function getNoteTypeFromTree(ast: Root): NoteType {
	let probableType: NoteType | undefined

	let lastNode: Node | undefined
	visit(ast, 'thematicBreak', (node, index, parent) => {
		if (parent === null || index === null) return CONTINUE

		probableType =
			lastNode?.type === 'thematicBreak' && node.type === 'thematicBreak'
				? 'Basic (and reversed card)'
				: 'Basic'

		lastNode = node
	})

	// If we didn't find a thematic break, we might have a cloze or type-in-the-answer note
	if (probableType === undefined) {
		visit(ast, (node) => {
			if (node.type === 'delete') {
				probableType = 'Cloze'
				return EXIT
			}

			if (node.type === 'emphasis') {
				probableType = 'Basic (type in the answer)'
				// Do not exit, cloze should win
			}
		})
	}

	if (probableType === undefined) {
		console.warn('Could not determine note type. Defaulting to basic.')
	}

	return probableType ?? 'Basic'
}

// Processor shared across operations
const processor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkFrontmatter, ['yaml'])
	.use(remarkObsidianLink, {
		toLink(wikiLink) {
			return {
				title: wikiLink.alias ?? wikiLink.value,
				uri: wikiLink.value,
				value: wikiLink.alias ?? wikiLink.value,
			}
		},
	})

async function getAstFromMarkdown(markdown: string): Promise<Root> {
	return processor.run(processor.parse(markdown))
}

console.log('----------------------------------')
const markdownContent = await fs.readFile('./test/assets/basic-type-in-the-answer.md', 'utf8')
const note = await getAnkiJsonFromMarkdown(markdownContent)
console.log(note)
console.log('----------------------------------')

// Console.log(`processedAst: ${JSON.stringify(processedAst, undefined, 2)}`)

// console.log(html)

// Const ast = processor.run(processor.parse(markdownContent))

// Log the entire AST
// console.log(JSON.stringify(processedAst, undefined, 2))

// Example of visiting nodes
// visit(ast, 'root', (node) => {
// 	console.log('Found a node item:', node)
// })

export async function invoke(
	action: string,
	version = 6,
	params: Record<string, unknown> = {},
): Promise<any> {
	try {
		const response = await fetch('http://127.0.0.1:8765', {
			body: JSON.stringify({ action, params, version }),
			headers: {
				'Content-Type': 'application/json',
			},
			method: 'POST',
		})

		if (!response.ok) {
			throw new Error('failed to issue request')
		}

		const data = (await response.json()) as Record<string, unknown>

		if (Object.keys(data).length !== 2) {
			throw new Error('response has an unexpected number of fields')
		}

		return data.result
	} catch (error) {
		throw new Error(`Request failed: ${String(error)}`)
	}
}

// Const noteIds = (await invoke('findNotes', 6, {
// 	query: 'deck:Default',
// })) as number[]

// const notes = (await invoke('notesInfo', 6, {
// 	notes: noteIds,
// })) as number[]

// console.log('----------------------------------')
// for (const note of notes) {
// 	console.log(note)
// }

function deleteFirstNodeOfType(tree: Root, nodeType: string): Root {
	visit(tree, nodeType, (_, index, parent) => {
		if (parent && index !== undefined) {
			parent.children.splice(index, 1)
			return EXIT
		}
	})

	return tree
}

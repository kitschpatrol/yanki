import type { Root } from 'mdast'
import { EXIT, visit } from 'unist-util-visit'
import { parse as yamlParse } from 'yaml'

export type Frontmatter = {
	deck?: string
	id?: number
	tags?: string[]
}

export function getFrontmatterFromTree(ast: Root): Frontmatter {
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

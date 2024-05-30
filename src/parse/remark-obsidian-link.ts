/**
 * Adaptation of https://github.com/aegatlin/remark-obsidian-link with some minor fixes.
 */

import type { Parent, Root } from 'mdast'
import remarkWikiLink from 'remark-wiki-link'
import { type Plugin } from 'unified'
import { u } from 'unist-builder'
import { CONTINUE, SKIP, visit } from 'unist-util-visit'

export type WikiLink = {
	alias?: string
	value: string
}

export type Link = {
	title?: string
	uri: string
	value: string
}

export type ToLink = (wikiLink: WikiLink) => Link | string

export type Options = {
	toLink?: ToLink
}

// Yeesh
type WikiLinkNode = {
	data: {
		alias: string
	}
	value: string
} & Parent

/**
 * A remark plugin that expands HTML comments in Markdown files.
 */
const remarkObsidianLink: Plugin<[Options?], Root> = function (options?: Options) {
	const toLink = options?.toLink ?? (({ alias, value }) => alias ?? value)

	this.use(remarkWikiLink, { aliasDivider: '|' })

	return function (tree) {
		visit(tree, 'wikiLink', (node: WikiLinkNode, index, parent) => {
			if (parent === undefined || index === undefined) return CONTINUE

			const wValue = node.value
			const wAlias = node.data.alias
			const wikiLink: WikiLink = {
				alias: wAlias === wValue ? undefined : wAlias.trim(),
				value: wValue.trim(),
			}

			const link = toLink(wikiLink)

			const newNode =
				typeof link === 'string'
					? u('text', link)
					: u('link', { title: link.title, url: link.uri }, [u('text', link.value)])

			parent.children.splice(index, 1, newNode)

			return [SKIP, index]
		})
	}
}

export default remarkObsidianLink

/* eslint-disable unicorn/consistent-function-scoping */
import { emptyIsUndefined } from '../../utilities/string'
import type { Image, Link } from 'mdast'
import type { CompileContext, Extension, Token } from 'mdast-util-from-markdown'
import { sanitizeUri } from 'micromark-util-sanitize-uri'

export function wikiBasicFromMarkdown(): Extension {
	let url = ''
	let label: string | undefined

	return {
		enter: {
			wikiEmbed: enterWikiEmbed,
			wikiLabel: enterWikiLabel,
			wikiLink: enterWikiLink,
			wikiUrl: enterWikiUrl,
		},
		exit: {
			wikiEmbed: exitWikiEmbed,
			wikiLabel: exitWikiLabel,
			wikiLink: exitWikiLink,
			wikiUrl: exitWikiUrl,
		},
	} satisfies Extension

	function enterWikiLink(this: CompileContext, token: Token): void {
		url = ''
		label = undefined

		this.enter(
			{
				children: [],
				title: undefined,
				type: 'link',
				url: '',
			},
			token,
		)
	}

	function enterWikiEmbed(this: CompileContext, token: Token): void {
		url = ''
		label = undefined

		this.enter(
			{
				type: 'image',
				url: '',
			},
			token,
		)
	}

	function enterWikiUrl(this: CompileContext): void {
		this.buffer()
	}

	function exitWikiUrl(this: CompileContext): void {
		url = this.resume()
	}

	function enterWikiLabel(this: CompileContext): void {
		this.buffer()
	}

	function exitWikiLabel(this: CompileContext): void {
		label = this.resume()
	}

	function exitWikiLink(this: CompileContext, token: Token): void {
		const currentNode = this.stack.at(-1) as Link
		currentNode.url = sanitizeUri(url)

		// Note some weird leaps to infer plausible link text
		currentNode.children = [
			{
				type: 'text',
				value:
					// Obsidian strips backslashes and pipes from link aliases, so we will too
					emptyIsUndefined((label ?? '').replaceAll('\\', '').replaceAll('|', '')) ??
					url.split('#').pop() ??
					url.split('/').pop() ??
					url,
			},
		]

		this.exit(token)
	}

	function exitWikiEmbed(this: CompileContext, token: Token): void {
		const currentNode = this.stack.at(-1) as Image
		currentNode.url = sanitizeUri(url)
		if (label !== undefined) {
			currentNode.alt = label
		}

		this.exit(token)
	}
}

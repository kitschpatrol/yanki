// Other syntax highlighting Rehype plugins:
// https://github.com/Microflash/rehype-starry-night
// https://github.com/rehypejs/rehype-highlight

import { yankiDefaultEmptyNotePlaceholderHast } from '../model/constants'
import { cleanClassName } from '../utilities/string'
import rehypeShiki from '@shikijs/rehype'
import { type Element, type Root as HastRoot } from 'hast'
import type { Root as MdastRoot } from 'mdast'
import rehypeMathjax from 'rehype-mathjax'
import rehypeRemoveComments from 'rehype-remove-comments'
import rehypeStringify from 'rehype-stringify'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { u } from 'unist-builder'

// Significant performance improvement by reusing this
const processor = unified()
	// .use(remarkGfm) // Not needed?
	// Don't allow dangerous HTML in the remark --> rehype step, else removing comments won't work
	.use(remarkRehype)
	.use(rehypeRemoveComments)
	.use(rehypeMathjax)
	// Messes up obsidian links and we should trust ourselves (and probably our plugins, too)
	// .use(rehypeSanitize)
	// Super slow...
	.use(rehypeShiki, {
		// See https://shiki.style/packages/rehype
		themes: {
			dark: 'github-dark',
			light: 'github-light',
		},
	})
	.use(rehypeStringify)
// .use(rehypeStringify, { allowDangerousCharacters: true, allowDangerousHtml: true })

export async function mdastToHtml(
	mdast: MdastRoot | undefined,
	cssClassNames: string[] | undefined = undefined,
	useEmptyPlaceholder = false,
): Promise<string> {
	if (mdast === undefined) {
		return ''
	}

	const hast = await processor.run(mdast)

	// Check for emptiness
	// TODO optimize this to avoid a second stringify...
	// would need to inspect the hast tree directly
	// to see if it matches the placeholder
	const checkResult = processor.stringify(hast).trim()
	const isEmpty = checkResult.length === 0

	if (cssClassNames === undefined || (isEmpty && !useEmptyPlaceholder)) {
		return checkResult
	}

	// Add a wrapper div with a specific class to the HTML
	// This is useful for styling the HTML output
	const nonEmptyHast = isEmpty ? yankiDefaultEmptyNotePlaceholderHast : hast
	const hastWithClass: HastRoot = u('root', [
		u(
			'element',
			{
				properties: {
					className: cssClassNames.map((name) => cleanClassName(name)),
				},
				tagName: 'div',
			},
			nonEmptyHast.children as Element[], // TODO: Fix this type error
		),
	])

	const htmlWithClass = processor.stringify(hastWithClass)

	return htmlWithClass.trim()
}

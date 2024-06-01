// Other syntax highlighting Rehype plugins:
// https://github.com/Microflash/rehype-starry-night
// https://github.com/rehypejs/rehype-highlight

import rehypeShiki from '@shikijs/rehype'
import type { Root } from 'mdast'
import rehypeMathjax from 'rehype-mathjax'
import rehypeRemoveComments from 'rehype-remove-comments'
import rehypeStringify from 'rehype-stringify'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

// Significant performance improvement by reusing this
const processor = unified()
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

export async function mdastToHtml(mdast: Root | undefined): Promise<string> {
	if (mdast === undefined) {
		return ''
	}

	const hast = await processor.run(mdast)
	const result = processor.stringify(hast)
	return result.trim()
}

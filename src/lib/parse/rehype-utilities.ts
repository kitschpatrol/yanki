// Other syntax highlighting Rehype plugins:
// https://github.com/Microflash/rehype-starry-night
// https://github.com/rehypejs/rehype-highlight

import rehypeShiki from '@shikijs/rehype'
import type { Root } from 'mdast'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

export async function mdastToHtml(mdast: Root): Promise<string> {
	const processor = unified()
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeSanitize)
		.use(rehypeShiki, {
			// See https://shiki.style/packages/rehype
			themes: {
				dark: 'github-dark',
				light: 'github-light',
			},
		})
		.use(rehypeStringify, { allowDangerousHtml: true })

	const file = await processor.run(mdast)
	const result = processor.stringify(file)
	return result
}

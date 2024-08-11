import { wikiBasicFromMarkdown } from './mdast-util-wiki-basic'
import { wikiBasic } from './micromark-extension-wiki-basic'
import { type Root } from 'mdast'
import { type Extension as FromMarkdownExtension } from 'mdast-util-from-markdown'
import { type Extension as MicromarkExtension } from 'micromark-util-types'
import { type Plugin, type Processor } from 'unified'

/**
 * This Remark plugin ONLY turns wiki links and Obsidian-style wiki link image
 * and media embeds into regular mdast link and image nodes.
 *
 * All wiki-style embeds are treated as images.
 *
 * Obsidian also supports wiki links in Markdown-style image and link syntax, so
 * handling resolution here would miss those cases, so:
 * - Resolution of wiki link into absolute paths happens later in
 *   remark-resolve-links.ts
 * - Parsing of Obsidian-style image size from alias / alt text happens later in
 *   rehype-utilities.ts
 * 
 * 
 * Note that only wiki links support spaces in the src, regular markdown
				links MUST be URI-encoded in the Markdown source Here, we URI-encode
				for consistency with the regular image syntax in the resulting HAST
				`<>` escaped spaces handled correctly already

				Images are also used for audio, and video, and other embeds in Obsidian...
 * 
 */
const plugin: Plugin<unknown[], Root> = function (this: Processor) {
	const data = this.data() as {
		fromMarkdownExtensions: FromMarkdownExtension[] | undefined
		micromarkExtensions: MicromarkExtension[] | undefined
	}

	data.micromarkExtensions = [...(data.micromarkExtensions ?? []), wikiBasic()]
	data.fromMarkdownExtensions = [...(data.fromMarkdownExtensions ?? []), wikiBasicFromMarkdown()]
}

export default plugin

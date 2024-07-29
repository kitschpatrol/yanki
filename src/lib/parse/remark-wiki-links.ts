// Custom Remark plugin to convert wiki links into MDAST link and image nodes

import { emptyIsUndefined } from '../utilities/string'
import { isUrl } from '../utilities/url'
import { type Root } from 'mdast'
import { findAndReplace } from 'mdast-util-find-and-replace'
import { type Plugin } from 'unified'
import { u } from 'unist-builder'

export type Options = {
	/**
	 * Automatically use the last part of the URL as the alias / alt text if no
	 * alias is provided
	 */
	automaticAlias?: boolean
}

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
 * Implementation vaguely informed by https://github.com/C1200/remark-wikilinks.
 * A proper parser in micromark would be better.
 *
 * @param options
 * @returns
 */
const plugin: Plugin<[Options], Root> = function (options = {}) {
	const { automaticAlias = false } = options

	return function (tree) {
		findAndReplace(
			tree,
			[
				// Note that only wiki links support spaces in the src, regular markdown
				// links MUST be URI-encoded in the Markdown source Here, we URI-encode
				// for consistency with the regular image syntax in the resulting HAST
				// `<>` escaped spaces handled correctly already

				// Image (Also used for audio, and video, and other embeds in Obsidian)
				[
					/!\[\[([^\]]+)]]/g,
					function (_, $1: string) {
						const [url, ...rest] = $1.split('|') as [string, string | undefined]

						// Obsidian DOES NOT strip backslashes and pipes from image alt
						// text, so neither will we.
						const alt = emptyIsUndefined(rest.join('|').replaceAll('\\', ''))

						// Obsidian-style parsing of image size from alt text happens in
						// remark-image-size.ts, because it can apply to markdown-style
						// image embeds as well Wiki link alias resolution happens later for
						// the same reason
						return u('image', {
							alt,
							url: isUrl(url) ? url : encodeURI(url),
						})
					},
				],

				// Links
				[
					/\[\[([^\]]+)]]/g,
					function (_, $1: string) {
						// Remote URL detection doesn't work because the link is already
						// converted...
						let [url, ...rest] = $1.split('|') as [string, string | undefined]
						const heading = url.split('#')?.at(-1)

						// Obsidian strips backslashes and pipes from link aliases, so we
						// will too
						let alias = emptyIsUndefined(rest.join('').replaceAll('\\', ''))

						// Wiki link alias resolution happens later
						alias ??= (automaticAlias ? (heading ?? url.split('/').pop()) : url)!
						url = isUrl(url) ? url : encodeURI(url)

						return u('link', { url }, [u('text', alias)])
					},
				],
			],
			{
				ignore: ['link', 'image'],
			},
		)
	}
}

export default plugin

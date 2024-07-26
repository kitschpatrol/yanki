// Vaguely via https://github.com/C1200/remark-wikilinks

import { emptyIsUndefined } from '../utilities/string'
import { isUrl } from '../utilities/url'
import { type Root } from 'mdast'
import { findAndReplace } from 'mdast-util-find-and-replace'
import { type Plugin } from 'unified'
import { u } from 'unist-builder'

export type Options = {
	automaticAlias?: boolean
}

// Not great, but it works...
// This plugin ONLY turns Wiki-style links and embeds into regular links,
// short link resolution and special alt text parsing happens elsewhere
// All embeds are treated as images
const plugin: Plugin<[Options], Root> = function (options = {}) {
	const { automaticAlias = false } = options

	return function (tree) {
		findAndReplace(
			tree,
			[
				// Note that only wiki links support spaces in the src, regular
				// markdown links MUST be URI-encoded in the markdown source
				// Here, we URI-encode for consistency with the regular image syntax
				// in the resulting HAST

				// <> escaped spaces handled correctly already
				// TODO what about wiki reference links?
				// TODO what about links to assets?
				// TODO what about image sizes?
				// TODO what about other file extensions?
				// TODO what about image size annotations in regular links?

				// Image, audio, and video
				[
					/!\[\[([^\]]+)]]/g,
					function (_, $1: string) {
						const [url, ...rest] = $1.split('|') as [string, string | undefined]

						// Obsidian DOES NOT strip backslashes and pipes from image alt text, so neither will we.
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
						// Remote URL detection doesn't work because the link is already converted...
						let [url, ...rest] = $1.split('|') as [string, string | undefined]
						const heading = url.split('#')?.at(-1)

						// Obsidian strips backslashes and pipes from link aliases, so we will too.
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

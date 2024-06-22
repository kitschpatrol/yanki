// Vaguely via https://github.com/C1200/remark-wikilinks

import { isUrl } from '../utilities/url'
import { type Root } from 'mdast'
import { findAndReplace } from 'mdast-util-find-and-replace'
import { type Plugin } from 'unified'
import { u } from 'unist-builder'

export type Options = {
	automaticAlias?: boolean
	obsidianVault?: string
}

// Not great, but it works...
const plugin: Plugin<[Options], Root> = function (options = {}) {
	const { automaticAlias = false, obsidianVault } = options

	return function (tree) {
		findAndReplace(
			tree,
			[
				// Note that only wiki links support spaces in the src, regular
				// markdown links MUST be URI-encoded in the markdown source
				// Here, we URI-encode for consistency with the regular image syntax
				// in the resulting HAST

				// Image, audio, and video
				[
					/!\[\[([^\]]+)]]/g,
					function (_, $1: string) {
						const [url, altText] = $1.split('|') as [string, string | undefined]

						return u('image', { altText, url: isUrl(url) ? url : encodeURI(url) })
					},
				],
				// Links
				[
					/\[\[([^\]]+)]]/g,
					function (_, $1: string) {
						// Remote URL detection doesn't work because the link is already converted...
						let [url, alias] = $1.split('|') as [string, string | undefined]
						const heading = url.split('#')?.at(-1)

						alias ??= (automaticAlias ? heading ?? url.split('/').pop() : url)!
						url = obsidianVault
							? `obsidian://open?vault=${encodeURIComponent(obsidianVault)}&file=${encodeURIComponent(url)}.md`
							: isUrl(url)
								? url
								: encodeURI(url)

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

import { type Root } from 'mdast'
import { type Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import { resolveLink } from '../utilities/resolve-link'
import { isUrl } from '../utilities/url'

export type Options = {
	allFilePaths?: string[]
	basePath?: string
	cwd: string
	enabled?: boolean
	obsidianVault?: string
}

const plugin: Plugin<[Options], Root> = function (options) {
	const { allFilePaths = [], basePath, cwd, enabled = true, obsidianVault } = options

	return function (tree) {
		// Disable so we can A/B test
		if (!enabled) {
			return
		}

		visit(tree, 'link', (node) => {
			// The hProperties object makes it into the final html
			node.data ??= {}
			node.data.hProperties = {
				...node.data?.hProperties,
				'data-yanki-src-original': node.url,
			}

			const resolvedLink = resolveLink(node.url, {
				allFilePaths,
				basePath,
				convertFilePathsToProtocol: obsidianVault === undefined ? 'none' : 'obsidian',
				cwd,
				obsidianVaultName: obsidianVault,
				type: 'link',
			})

			node.url = isUrl(resolvedLink) ? resolvedLink : encodeURI(resolvedLink)

			// TMI
			// node.data.hProperties['data-yanki-src-resolved'] = node.url
		})

		visit(tree, 'image', (node) => {
			// The hProperties object makes it into the final html
			node.data ??= {}
			node.data.hProperties = {
				...node.data?.hProperties,
				'data-yanki-src-original': node.url,
			}

			const resolvedLink = resolveLink(node.url, {
				allFilePaths,
				basePath,
				convertFilePathsToProtocol: obsidianVault === undefined ? 'none' : 'obsidian',
				cwd,
				obsidianVaultName: obsidianVault,
				type: 'embed',
			})

			node.url = isUrl(resolvedLink) ? resolvedLink : encodeURI(resolvedLink)

			// TMI
			// Images will pick up a data-yanki-media-src if they're managed
			// node.data.hProperties['data-yanki-src-resolved'] = node.url
		})
	}
}

export default plugin

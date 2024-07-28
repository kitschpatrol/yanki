import { resolveFilePathOrUrl } from '../utilities/resolve-file-path-or-url'
import { type Root } from 'mdast'
import { type Plugin } from 'unified'
import { visit } from 'unist-util-visit'

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
			node.url = resolveFilePathOrUrl(node.url, {
				allFilePaths,
				basePath,
				convertFilePathsToProtocol: obsidianVault === undefined ? 'none' : 'obsidian',
				cwd,
				defaultExtension: 'md',
				obsidianVaultName: obsidianVault,
			})
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
			node.url = resolveFilePathOrUrl(node.url, {
				allFilePaths,
				basePath,
				cwd,
				defaultExtension: undefined,
				obsidianVaultName: undefined,
			})
			// TMI
			// Images will pick up a data-yanki-media-src if they're managed
			// node.data.hProperties['data-yanki-src-resolved'] = node.url
		})
	}
}

export default plugin

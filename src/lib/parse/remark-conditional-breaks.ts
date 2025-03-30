import type { Root } from 'mdast'
import type { Plugin } from 'unified'
import remarkBreaks from 'remark-breaks'

const plugin: Plugin<[undefined?], Root> = function () {
	return function (tree, file) {
		if (file.data.strictLineBreaks === false) {
			remarkBreaks()(tree)
			return
		}

		return tree
	}
}

export default plugin

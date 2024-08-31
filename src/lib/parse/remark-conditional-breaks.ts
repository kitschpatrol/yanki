import { type Root } from 'mdast'
import remarkBreaks from 'remark-breaks'
import { type Plugin } from 'unified'

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

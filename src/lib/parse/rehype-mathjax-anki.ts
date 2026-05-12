import type { Root } from 'hast'
import type { Plugin } from 'unified'
import { CONTINUE, visit } from 'unist-util-visit'

// Runs of consecutive `{` or `}` collide with Anki's cloze syntax (`{{c1::…}}`),
// causing its non-greedy cloze regex to terminate the cloze inside the math.
// MathJax tolerates whitespace between braces, so breaking up the runs keeps
// rendering identical while making the math safe to embed in a cloze.
// See https://github.com/kitschpatrol/yanki/issues/15
const CONSECUTIVE_BRACES_REGEX = /([{}])(?=[{}])/g

function sanitizeBraces(value: string): string {
	return value.replaceAll(CONSECUTIVE_BRACES_REGEX, '$1 ')
}

/**
 * Non-rendering replacement for the `rehype-mathjax` plugin, which takes output
 * from `remark-math` and wraps it in Anki-specific syntax.
 *
 * See https://docs.ankiweb.net/math.html?#mathjax
 */
const plugin: Plugin<unknown[], Root> = function () {
	return function (tree) {
		// Always treat fenced blocks as... blocks
		let fenced = false

		visit(tree, (node, index, parent) => {
			if (parent === undefined || index === undefined || node.type !== 'element') {
				return CONTINUE
			}

			// Handle fenced, ```math...``` blocks, which end up inside a `<pre>` element
			// TODO... clean up
			if (
				node.tagName === 'pre' &&
				node.children.length === 1 &&
				node.children[0].type === 'element' &&
				node.children[0].tagName === 'code' &&
				Array.isArray(node.children[0].properties.className) &&
				node.children[0].properties.className.includes('language-math')
			) {
				fenced = true
				parent.children.splice(index, 1, node.children[0])
			}

			// Handle direct
			if (
				node.tagName === 'code' &&
				Array.isArray(node.properties.className) &&
				node.properties.className.includes('language-math')
			) {
				// Anki's documentation calls for \[ and \] for block math, \( and \)
				// for inline math, but this seems to be replaced in the Anki editor by
				// the `<anki-mathjax block="true">` and <anki-mathjax> custom elements,
				// respectively, which seems weird and might threaten note stability across syncs?
				//
				// Tried adding `remark-math` tags directly, but this was not compatible with Anki Mobile.
				//
				// Note that `remark-math` only considers an equation to be a block if
				// it contains line breaks, it does not distinguish between `$` and
				// `$$`. (TODO fix this?)

				const isBlock = node.properties.className.includes('math-display') || fenced
				fenced = false

				for (const child of node.children) {
					if (child.type === 'text') {
						child.value = sanitizeBraces(child.value)
					}
				}

				node.tagName = isBlock ? 'div' : 'span'
				node.children = [
					{ type: 'text', value: isBlock ? String.raw`\[` : String.raw`\(` },
					...node.children,
					{ type: 'text', value: isBlock ? String.raw`\]` : String.raw`\)` },
				]
			}
		})
	}
}

export default plugin

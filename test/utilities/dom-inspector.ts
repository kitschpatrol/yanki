/* eslint-disable jsdoc/require-jsdoc */

import { parseHTML } from 'linkedom'

// Export function getLinksAndEmbeds

/**
 * Test helper to get all attributes as an object for all instances of a
 * specific tag in an HTML fragments
 * @param htmlFragment - The HTML fragment to search
 * @param tag - The tag to search for
 * @returns Array of objects, each object representing the attributes of a tag
 * @public
 */
export function getAttributesOfAllNodes(
	htmlFragment: string,
	tag: keyof HTMLElementTagNameMap,
): Array<Record<string, string>> {
	const { document } = parseHTML(htmlFragment)
	const elements = document.querySelectorAll(tag)
	const attributes: Array<Record<string, string>> = []
	for (const element of elements) {
		const attributesObject: Record<string, string> = {}

		for (const attribute of element.attributes) {
			attributesObject[attribute.name] = attribute.value
		}

		if (Object.keys(attributesObject).length > 0) {
			attributes.push(attributesObject)
		}
	}

	return attributes
}

/**
 * Test helper to get all links and embeds in an HTML fragment
 * @param htmlFragment - The HTML fragment to search
 * @returns Array of objects, each object representing the attributes of a tag
 * @public
 */
export function getAnkiMediaTags(htmlFragment: string): string[] {
	const matches = htmlFragment.match(/\[sound:[^\]]+\]/gi)
	return matches ?? []
}

export function stripAnkiMediaTag(text: string): string {
	const match = /^\[sound:(.*)\]$/.exec(text)
	return match ? match[1] : text
}

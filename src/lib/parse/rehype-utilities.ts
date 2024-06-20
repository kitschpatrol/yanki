// Other syntax highlighting Rehype plugins:
// https://github.com/Microflash/rehype-starry-night
// https://github.com/rehypejs/rehype-highlight

import { yankiDefaultEmptyNotePlaceholderHast } from '../model/constants'
import { yankiSupportedAudioVideoFormats, yankiSupportedImageFormats } from '../model/model'
import { getSafeAnkiMediaFilename, isUrl } from '../utilities/file'
import { cleanClassName } from '../utilities/string'
import rehypeShiki from '@shikijs/rehype'
import { type Element, type Root as HastRoot } from 'hast'
import { toText } from 'hast-util-to-text'
import type { Root as MdastRoot } from 'mdast'
import path from 'path-browserify-esm'
import rehypeMathjax from 'rehype-mathjax'
import rehypeParse from 'rehype-parse'
import rehypeRemoveComments from 'rehype-remove-comments'
import rehypeStringify from 'rehype-stringify'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { u } from 'unist-builder'
import { CONTINUE, EXIT, visit } from 'unist-util-visit'

// Significant performance improvement by reusing this
const processor = unified()
	// .use(remarkGfm) // Not needed?
	// Don't allow dangerous HTML in the remark --> rehype step, else removing comments won't work
	.use(remarkRehype)
	.use(rehypeRemoveComments)
	.use(rehypeMathjax)
	// Messes up obsidian links and we should trust ourselves (and probably our plugins, too)
	// .use(rehypeSanitize)
	// Super slow...
	.use(rehypeShiki, {
		// See https://shiki.style/packages/rehype
		themes: {
			dark: 'github-dark',
			light: 'github-light',
		},
	})
	.use(rehypeStringify)
// .use(rehypeStringify, { allowDangerousCharacters: true, allowDangerousHtml: true })

export async function mdastToHtml(
	mdast: MdastRoot | undefined,
	cssClassNames: string[] | undefined,
	useEmptyPlaceholder: boolean,
	/** Path containing the note, used to resolve relative paths in media src paths */
	cwd: string,
	/** Namespace to prepend to the media filenames for easy clean-up later */
	namespace: string,
): Promise<string> {
	if (mdast === undefined) {
		return ''
	}

	const hast = await processor.run(mdast)

	// Check for emptiness
	// TODO optimize this to avoid a second stringify...
	// would need to inspect the hast tree directly
	// to see if it matches the placeholder
	const checkResult = processor.stringify(hast).trim()
	const isEmpty = checkResult.length === 0

	if (cssClassNames === undefined || (isEmpty && !useEmptyPlaceholder)) {
		return checkResult
	}

	// Add a wrapper div with a specific class to the HTML
	// This is useful for styling the HTML output
	const nonEmptyHast = isEmpty ? yankiDefaultEmptyNotePlaceholderHast : hast
	const hastWithClass: HastRoot = u('root', [
		u(
			'element',
			{
				properties: {
					className: cssClassNames.map((name) => cleanClassName(name)),
				},
				tagName: 'div',
			},
			nonEmptyHast.children as Element[], // TODO: Fix this type error
		),
	])

	// Handle Media
	// 1. Find image tags... which are also where we'll find audio/video sources via Obsidian
	// 2. Convert any relative URLs to absolute URLs
	// 3. Devise a "safe" filename for Anki to use, based on the original path
	// 4. Detect if image or audio/video
	// 5. If image, replace the src with a safe filename and embed the original
	//    path in a data attribute, which is later processed by the functions in
	//    anki-connect.ts.
	// 6. If audio/video, replace the img element with a span with a data
	//    attribute with the original path and Anki's markup for embedding
	//    audio/video.

	const originalCwd = path.process_cwd
	path.setCWD(cwd)

	visit(hastWithClass, 'element', (node, index, parent) => {
		if (parent === undefined || index === undefined || node.tagName !== 'img') return CONTINUE

		// Ensure src is a string
		if (typeof node.properties.src !== 'string' || node.properties?.src?.trim().length === 0) {
			console.warn('Image has no src')
			return CONTINUE
		}

		// Check if src is a remote url
		if (isUrl(node.properties.src)) {
			console.warn('Image is remote, action TBD')
			return CONTINUE
		}

		const absoluteSrc = path.resolve(node.properties.src)
		const safeFilename = getSafeAnkiMediaFilename(absoluteSrc, namespace)
		const extension = path.extname(absoluteSrc).slice(1)

		if ((yankiSupportedImageFormats as unknown as string[]).includes(extension)) {
			node.properties.src = safeFilename
			node.properties.className = ['yanki-media', 'yanki-media-image']
			node.properties['data-src-original'] = absoluteSrc
		} else if ((yankiSupportedAudioVideoFormats as unknown as string[]).includes(extension)) {
			// Replace the current node with a span
			// containing the Anki media embedding syntax
			// Using <audio> and <video> tags would be nicer, and <audio> kind of works on desktop,
			// but this breaks on mobile, so we have to use the [sound:] syntax
			parent.children.splice(
				index,
				1,
				u(
					'element',
					{
						properties: {
							className: ['yanki-media', 'yanki-media-audio-video'],
							'data-filename': safeFilename,
							'data-src-original': absoluteSrc,
						},
						tagName: 'span',
					},
					[u('text', `[sound:${safeFilename}]`)],
				),
			)
		} else {
			console.warn(`Unsupported media format: ${extension}`)
		}
	})

	path.setCWD(originalCwd)

	// Edge case... if a note ONLY has MathJax in the front field, Anki will think it's empty
	// (Anki-connect error message: "cannot create note because it is empty")
	// So we have to add a hidden content field to convince Anki otherwise...
	visit(hastWithClass, 'element', (node, _, parent) => {
		if (parent === undefined) return CONTINUE

		if (node.tagName === 'mjx-container') {
			const index = parent.children.indexOf(node)
			parent.children.splice(
				index + 1,
				0,
				u(
					'element',
					{
						properties: {
							style: 'display: none;',
						},
						tagName: 'span',
					},
					[u('text', 'Not empty')],
				),
			)
			// One is enough
			return EXIT
		}
	})

	const htmlWithClass = processor.stringify(hastWithClass)

	return htmlWithClass.trim()
}

const htmlProcessor = unified().use(rehypeParse, { fragment: true })

function htmlToPlainText(html: string): string {
	const hast = htmlProcessor.parse(html)
	return toText(hast)
}

export function getFirstLineOfHtmlAsPlainText(html: string): string {
	const text = htmlToPlainText(html)
	return (
		text
			.split('\n')
			.map((line) => line.trim())
			.find((line) => line.length > 0) ?? ''
	)
}

export type Media = {
	filename: string
	originalSrc: string
}

export function extractMediaFromHtml(html: string): Media[] {
	const hast = htmlProcessor.parse(html)
	const media: Media[] = []

	// Assumes media-related manipulations performed by
	// mdastToHtml have already been done
	visit(hast, 'element', (node) => {
		if (node.tagName === 'img' || node.tagName === 'span') {
			const filename = node.properties?.src ?? node.properties?.dataFilename
			const originalSrc = node.properties?.dataSrcOriginal
			if (
				filename !== undefined &&
				originalSrc !== undefined &&
				typeof filename === 'string' &&
				typeof originalSrc === 'string'
			) {
				media.push({
					filename,
					originalSrc,
				})
			} else if (node.tagName === 'img') {
				console.warn('Image has no src or original src data')
			}
		}
	})

	return media
}

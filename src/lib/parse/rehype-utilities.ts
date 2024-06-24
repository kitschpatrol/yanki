// Other syntax highlighting Rehype plugins:
// https://github.com/Microflash/rehype-starry-night
// https://github.com/rehypejs/rehype-highlight

import {
	MEDIA_SUPPORTED_AUDIO_VIDEO_EXTENSIONS,
	MEDIA_SUPPORTED_IMAGE_EXTENSIONS,
	NOTE_DEFAULT_EMPTY_HAST,
} from '../shared/constants'
import {
	type GlobalOptions,
	defaultGlobalOptions,
	getDefaultFetchAdapter,
	getDefaultFileAdapters,
} from '../shared/types'
import { getAnkiMediaFilenameExtension, getSafeAnkiMediaFilename } from '../utilities/media'
import { cleanClassName } from '../utilities/string'
import { fileUrlToPath, getSrcType } from '../utilities/url'
import rehypeShiki from '@shikijs/rehype'
import { deepmerge } from 'deepmerge-ts'
import { type Element, type Root as HastRoot } from 'hast'
import { toText } from 'hast-util-to-text'
import type { Root as MdastRoot } from 'mdast'
import path from 'path-browserify-esm'
import rehypeMathjax from 'rehype-mathjax'
import rehypeParse from 'rehype-parse'
import rehypeRemoveComments from 'rehype-remove-comments'
import rehypeStringify from 'rehype-stringify'
import remarkRehype from 'remark-rehype'
import { type Simplify } from 'type-fest'
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

export type MdastToHtmlOptions = Simplify<
	{
		/** CSS class names to apply to the output HTML */
		cssClassNames?: string[]
		/** Whether to use an empty placeholder if the output is empty */
		useEmptyPlaceholder?: boolean
	} & Pick<GlobalOptions, 'cwd' | 'fetchAdapter' | 'fileAdapters' | 'namespace' | 'syncMediaAssets'>
>

const defaultMdastToHtmlOptions: MdastToHtmlOptions = {
	...defaultGlobalOptions,
}

export async function mdastToHtml(
	mdast: MdastRoot | undefined,
	options: Partial<MdastToHtmlOptions>,
): Promise<string> {
	if (mdast === undefined) {
		return ''
	}

	const {
		cssClassNames,
		cwd,
		fetchAdapter = getDefaultFetchAdapter(),
		fileAdapters = getDefaultFileAdapters(),
		namespace,
		syncMediaAssets,
		useEmptyPlaceholder,
	} = deepmerge(defaultMdastToHtmlOptions, options ?? {})

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
	const nonEmptyHast = isEmpty ? NOTE_DEFAULT_EMPTY_HAST : hast
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

	const treeMutationPromises: Array<() => Promise<void>> = []

	if (syncMediaAssets !== 'off') {
		const originalCwd = path.process_cwd
		path.setCWD(cwd)

		visit(hastWithClass, 'element', (node, index, parent) => {
			if (parent === undefined || index === undefined || node.tagName !== 'img') return CONTINUE

			// Ensure src is a string
			if (typeof node.properties.src !== 'string' || node.properties?.src?.trim().length === 0) {
				console.warn('Image has no src')
				return CONTINUE
			}

			// Turn file URLs into paths before doing the URL check so they'll
			// be routed the local asset logic (Anki can't load file URLs anyway)
			const srcType = getSrcType(node.properties.src)

			if (srcType === 'unsupportedProtocolUrl') {
				console.warn(`Unsupported URL protocol for media asset: "${node.properties.src}"`)
				return CONTINUE
			}

			if (syncMediaAssets === 'local' && srcType === 'remoteHttpUrl') {
				return CONTINUE
			}

			if (
				syncMediaAssets === 'remote' &&
				(srcType === 'localFileUrl' || srcType === 'localFilePath')
			) {
				return CONTINUE
			}

			// The src will be URI-encoded at this point, which we don't want for local files
			// Local file URLs must be converted into paths before decoding, and must be absolute
			// already so they are not resolved
			const absoluteSrcOrUrl =
				srcType === 'remoteHttpUrl'
					? node.properties.src
					: srcType === 'localFilePath'
						? path.resolve(decodeURIComponent(node.properties.src))
						: decodeURIComponent(fileUrlToPath(node.properties.src))

			// Run these after visit since visit can not be asynchronous
			treeMutationPromises.push(async () => {
				// These handle url vs. file path internally..
				const safeFilename = await getSafeAnkiMediaFilename(
					absoluteSrcOrUrl,
					namespace,
					fileAdapters,
					fetchAdapter,
				)

				const extension = await getAnkiMediaFilenameExtension(absoluteSrcOrUrl, fetchAdapter)

				if (extension === undefined) {
					console.warn(`Could not determine extension for ${String(node.properties.src)}`)
					return
				}

				// Assume remote image assets without a valid extension  are images... they will have 'unknown' as their extension if MEDIA_ALLOW_UNKNOWN_URL_EXTENSION is true
				if (
					(['unknown', ...MEDIA_SUPPORTED_IMAGE_EXTENSIONS] as unknown as string[]).includes(
						extension,
					)
				) {
					node.properties.src = safeFilename
					node.properties.className = ['yanki-media', 'yanki-media-image']
					node.properties['data-src-original'] = absoluteSrcOrUrl
				} else if (
					(MEDIA_SUPPORTED_AUDIO_VIDEO_EXTENSIONS as unknown as string[]).includes(extension)
				) {
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
									'data-alt-text': node.properties.alt, // If available, why not
									'data-filename': safeFilename,
									'data-src-original': absoluteSrcOrUrl,
								},
								tagName: 'span',
							},
							[u('text', `[sound:${safeFilename}]`)],
						),
					)
				} else {
					console.warn(`Unsupported media format: ${extension} for ${String(node.properties.src)}`)
				}
			})
		})

		// Run the tree mutation promises
		for (const mutationPromise of treeMutationPromises) {
			await mutationPromise()
		}

		path.setCWD(originalCwd)
	}

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
			} else if (node.tagName === 'img' && node.properties?.src !== undefined) {
				// Console.warn(`Ignoring image without decipherable source: ${String(node.properties.src)}`)
			}
		}
	})

	return media
}

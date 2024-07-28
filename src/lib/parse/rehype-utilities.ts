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
	getDefaultFileAdapter,
} from '../shared/types'
import {
	getAnkiMediaFilenameExtension,
	getSafeAnkiMediaFilename,
	mediaAssetExists,
} from '../utilities/media'
import { getBaseAndQueryParts } from '../utilities/path'
import { cleanClassName, emptyIsUndefined } from '../utilities/string'
import { getSrcType } from '../utilities/url'
import rehypeShiki from '@shikijs/rehype'
import { deepmerge } from 'deepmerge-ts'
import { type Element, type Root as HastRoot } from 'hast'
import { toText } from 'hast-util-to-text'
import type { Root as MdastRoot } from 'mdast'
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
		defaultLanguage: 'plaintext',
		fallbackLanguage: 'plaintext',
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
	} & Pick<GlobalOptions, 'fetchAdapter' | 'fileAdapter' | 'namespace' | 'syncMediaAssets'>
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
		fetchAdapter = getDefaultFetchAdapter(),
		fileAdapter = await getDefaultFileAdapter(),
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
	// 1. Find image tags... which are also where we'll find audio/video sources
	//    via Obsidian. (All local URLs should already be absolute because of the
	//    earlier `remark-resolve-links.ts` pass.)
	// 2. Devise a "safe" filename for Anki to use, based on the original path
	// 3. Detect if image or audio/video
	// 4. If image, replace the src with a safe filename and embed the original
	//    path in a data attribute, which is later processed by the functions in
	//    anki-connect.ts.
	// 5. If audio/video, replace the img element with a span with a data
	//    attribute with the original path and Anki's markup for embedding
	//    audio/video.

	const treeMutationPromises: Array<() => Promise<void>> = []

	// All media embeds are initially image tags
	visit(hastWithClass, 'element', (node, index, parent) => {
		if (parent === undefined || index === undefined || node.tagName !== 'img') return CONTINUE

		// Ensure src is a string
		if (typeof node.properties.src !== 'string' || node.properties?.src?.trim().length === 0) {
			console.warn('Image has no src')
			return CONTINUE
		}

		// Ensure src is a reasonable looking local file path or remote URL
		let absoluteSrcOrUrl: string | undefined
		const srcType = getSrcType(node.properties.src)
		switch (srcType) {
			// All of these invalid image src types should have been converted already during MDAST generation
			case 'unsupportedProtocolUrl':
			case 'obsidianVaultUrl':
			case 'localFileUrl':
			case 'localFileName': {
				console.warn(`Unsupported URL for media asset: "${node.properties.src}"`)
				return CONTINUE
			}

			case 'remoteHttpUrl': {
				absoluteSrcOrUrl = node.properties.src
				// TODO, necessary?
				// try {
				// 	absoluteSrcOrUrl = decodeURI(node.properties.src) // Always absolute already
				// } catch (error) {
				// 	console.warn(`Error decoding src: ${node.properties.src}`, error)
				// 	return CONTINUE
				// }

				break
			}

			case 'localFilePath': {
				// The src will be URI-encoded at this point, which we don't want for local files
				// Local file URLs must be converted into paths before decoding, and must be absolute
				// already so they are not resolved
				try {
					absoluteSrcOrUrl = decodeURI(node.properties.src) // Always absolute already
				} catch (error) {
					console.warn(`Error decoding src: "${node.properties.src}"`, error)
					return CONTINUE
				}

				// Ignore any query parameters on local files
				const [base] = getBaseAndQueryParts(absoluteSrcOrUrl)
				absoluteSrcOrUrl = base

				break
			}
		}

		// Run these after visit since visit can not be asynchronous
		treeMutationPromises.push(async () => {
			const extension = await getAnkiMediaFilenameExtension(absoluteSrcOrUrl, fetchAdapter)

			// If Yanki should sync the asset, it will generate a new finalSrcURl and add a data property to
			// the field so that the sync algorithms in anki-connect.ts can find it and sync it
			let finalSrcUrl: string = absoluteSrcOrUrl
			let yankiSyncMedia: boolean =
				(extension !== undefined && srcType === 'localFilePath' && syncMediaAssets === 'local') ||
				(srcType === 'remoteHttpUrl' && syncMediaAssets === 'remote') ||
				syncMediaAssets === 'all'

			// Make sure the file exists if we're going to sync it
			// If it doesn't, we will still wrap it but it can't be managed by Anki
			if (yankiSyncMedia) {
				const exists = await mediaAssetExists(absoluteSrcOrUrl, fileAdapter, fetchAdapter)
				if (exists) {
					// These handle url vs. file path internally...
					finalSrcUrl = await getSafeAnkiMediaFilename(
						absoluteSrcOrUrl,
						namespace,
						fileAdapter,
						fetchAdapter,
					)
				} else {
					console.warn(
						`Could not find media asset: "${absoluteSrcOrUrl}" (Original src: "${String(node.properties.src)}"`,
					)
					yankiSyncMedia = false
				}
			}

			if (extension === undefined) {
				// Rare case of NOT wrapping the embed image, this will just yield a
				// broken image

				console.warn(`Missing or unsupported file extension for ${String(node.properties.src)}`)

				// Replace with a placeholder indicating that it's unsupported
				parent.children.splice(
					index,
					1,
					u(
						'element',
						{
							properties: {
								className: ['yanki-media', 'yanki-media-unsupported'],
								'data-yanki-alt-text': node.properties.alt, // If available, why not keep it
								'data-yanki-media-src': absoluteSrcOrUrl,
								'data-yanki-src': finalSrcUrl,
								'data-yanki-src-original': node.properties.dataYankiSrcOriginal,
								// 'data-yanki-media-sync': 'false', // Never syncs
							},
							tagName: 'span',
						},
						[u('text', `Unsupported media: ${String(node.properties.src)}`)],
					),
				)
			} else if (
				// Assume remote image assets without a valid extension are images...
				// they will have 'unknown' as their extension if
				// MEDIA_ALLOW_UNKNOWN_URL_EXTENSION is true
				(['unknown', ...MEDIA_SUPPORTED_IMAGE_EXTENSIONS] as unknown as string[]).includes(
					extension,
				)
			) {
				// Image, update the img tag
				// Width and height will be set later
				node.properties.src = finalSrcUrl
				node.properties.className = ['yanki-media', 'yanki-media-image']
				node.properties['data-yanki-media-src'] = absoluteSrcOrUrl
				node.properties['data-yanki-media-sync'] = yankiSyncMedia ? 'true' : 'false'
			} else if (
				(MEDIA_SUPPORTED_AUDIO_VIDEO_EXTENSIONS as unknown as string[]).includes(extension)
			) {
				// Audio or video

				// Replace the current img node with a span
				// containing the weirdo Anki media embedding syntax

				// Using <audio> and <video> tags would be nicer, and <audio> kind of
				// works on desktop, but this breaks on mobile, so we shall use the
				// [sound:] syntax
				parent.children.splice(
					index,
					1,
					u(
						'element',
						{
							properties: {
								className: ['yanki-media', 'yanki-media-audio-video'],
								'data-yanki-alt-text': node.properties.alt, // If available, why not keep it
								'data-yanki-media-src': absoluteSrcOrUrl,
								'data-yanki-media-sync': yankiSyncMedia ? 'true' : 'false',
								'data-yanki-src': finalSrcUrl,
								'data-yanki-src-original': node.properties.dataYankiSrcOriginal,
							},
							tagName: 'span',
						},
						[u('text', `[sound:${finalSrcUrl}]`)],
					),
				)
			}
		})
	})

	// Run the tree mutation promises over the <img> nodes
	for (const mutationPromise of treeMutationPromises) {
		await mutationPromise()
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

	// Extract image size metadata from alt text
	// This is an Obsidian feature...
	// Do this here instead of in generic HAST plugin because
	// some images are converted to spans prior...
	visit(hastWithClass, 'element', (node, index, parent) => {
		if (
			parent === undefined ||
			index === undefined ||
			node.tagName !== 'img' ||
			emptyIsUndefined(String(node.properties.alt)) === undefined
		) {
			return CONTINUE
		}

		// Get dimensions from the alt text
		const originalAltText = String(node.properties.alt ?? '')
		const { alt, height, width } = parseDimensionsFromAltText(originalAltText)

		if (alt === undefined) {
			delete node.properties.alt
		} else {
			node.properties.alt = alt
		}

		if (height !== undefined) {
			node.properties.height = height
		}

		if (width !== undefined) {
			node.properties.width = width
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
		if (
			(node.tagName === 'img' || node.tagName === 'span') &&
			node.properties?.dataYankiMediaSync === 'true'
		) {
			const filename =
				// <img>
				node.properties?.src ??
				// <span>>
				node.properties?.dataYankiSrc

			const originalSrc = node.properties?.dataYankiMediaSrc
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
			}
		}
	})

	// Console.log('extractMedia----------------------------------')
	// console.log(media)

	return media
}

function parseDimensionsFromAltText(alt: string): {
	alt: string | undefined
	height: number | undefined
	width: number | undefined
} {
	// Obsidian only parses last | delimited element of alt text
	const altParts = alt.split('|')
	const lastAltPart = emptyIsUndefined(altParts.pop())
	const firstAltPart = emptyIsUndefined(altParts.join('|'))

	if (lastAltPart !== undefined) {
		const { height, width } = parseDimensions(lastAltPart)
		if (width !== undefined || height !== undefined) {
			return {
				alt: firstAltPart,
				height,
				width,
			}
		}
	}

	return {
		alt,
		height: undefined,
		width: undefined,
	}
}

function parseDimensions(dimensions: string): {
	height: number | undefined
	width: number | undefined
} {
	// Ensure all characters in the string are number or 'x':
	if (!/^[\dx]+$/.test(dimensions)) {
		return { height: undefined, width: undefined }
	}

	// Try for a single number first
	if (!dimensions.includes('x')) {
		const widthOnly = Number.parseInt(dimensions, 10)

		if (!Number.isNaN(widthOnly)) {
			return { height: undefined, width: widthOnly }
		}
	}

	// Check for an 'x' separator
	const [width, height] = dimensions.split('x').map((dim) => Number.parseInt(dim, 10)) as [
		number | undefined,
		number | undefined,
	]

	// Have to pull these out due to error glitch
	const widthIsNan = Number.isNaN(width)
	const heightIsNan = Number.isNaN(height)

	return {
		height: heightIsNan || height === undefined ? undefined : height,
		width: widthIsNan || width === undefined ? undefined : width,
	}
}

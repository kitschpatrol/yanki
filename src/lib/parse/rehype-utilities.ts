// Helpers for converting MDAST trees to HTML

import {
	MEDIA_SUPPORTED_AUDIO_VIDEO_EXTENSIONS,
	MEDIA_SUPPORTED_FILE_EXTENSIONS,
	MEDIA_SUPPORTED_IMAGE_EXTENSIONS,
	NOTE_DEFAULT_EMPTY_HAST,
} from '../shared/constants'
import {
	type GlobalOptions,
	defaultGlobalOptions,
	getDefaultFetchAdapter,
	getDefaultFileAdapter,
} from '../shared/types'
import { getAnkiMediaFilenameExtension, getSafeAnkiMediaFilename } from '../utilities/media'
import { getBase, getQuery } from '../utilities/path'
import { cleanClassName, emptyIsUndefined } from '../utilities/string'
import { getSrcType, isUrl, safeDecodeURI } from '../utilities/url'
import rehypeMathjaxAnki from './rehype-mathjax-anki'
import rehypeShiki from '@shikijs/rehype'
import { deepmerge } from 'deepmerge-ts'
import { type Element, type ElementContent, type Root as HastRoot } from 'hast'
import { toText } from 'hast-util-to-text'
import type { Root as MdastRoot } from 'mdast'
import rehypeFormat from 'rehype-format'
import rehypeParse from 'rehype-parse'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkRehype from 'remark-rehype'
import { type Simplify } from 'type-fest'
import { unified } from 'unified'
import { u } from 'unist-builder'
import { CONTINUE, EXIT, visit } from 'unist-util-visit'

// Significant performance improvement by reusing the processor
const processor = unified()
	// Not needed?
	.use(remarkRehype, { allowDangerousHtml: true })
	// Re-parses any raw HTML in the Markdown into the HAST tree,
	// otherwise it ends up as text in raw-typed nodes. This allows
	// things like manual <img> tags to be managed as Anki assets, and protects
	// inline style tags from removal.
	.use(rehypeRaw)
	.use(rehypeMathjaxAnki)
	//  Not needed?
	// .use(rehypeRemoveComments)
	// Messes up obsidian links and we should trust ourselves (and probably our plugins, too)
	// .use(rehypeSanitize)
	// Super slow...
	// Other syntax highlighting Rehype plugins:
	// https://github.com/Microflash/rehype-starry-night
	// https://github.com/rehypejs/rehype-highlight
	.use(rehypeShiki, {
		// See https://shiki.style/packages/rehype
		defaultLanguage: 'plaintext',
		fallbackLanguage: 'plaintext',
		themes: {
			dark: 'github-dark',
			light: 'github-light',
		},
	})
	// .use(rehypeStringify, { allowDangerousCharacters: true, allowDangerousHtml: true })
	.use(rehypeFormat)
	.use(rehypeStringify)

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

	// Add a wrapper div with a specific class to the HTML, this is hypothetically
	// useful for styling the output via CSS
	const hastWithClass: HastRoot = u('root', [
		u(
			'element',
			{
				properties: {
					className: cssClassNames?.map((name) => cleanClassName(name)),
				},
				tagName: 'div',
			},
			hast.children as Element[], // TODO: Fix this type error
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

	// All media embeds are initially in <img> tags
	visit(hastWithClass, 'element', (node, index, parent) => {
		if (parent === undefined || index === undefined || node.tagName !== 'img') return CONTINUE

		// Ensure src is a string
		if (typeof node.properties.src !== 'string' || node.properties?.src?.trim().length === 0) {
			console.warn('Image has no src')
			return CONTINUE
		}

		// Ensure src is a reasonable looking local file path or remote URL
		let absolutePathOrUrl: string | undefined
		const srcType = getSrcType(node.properties.src)
		switch (srcType) {
			// All of these invalid image src types should have been converted already during MDAST generation
			case 'unsupportedProtocolUrl':
			case 'localFileName': {
				console.warn(`Unsupported URL for media asset, treating as link: "${node.properties.src}"`)
				absolutePathOrUrl = node.properties.src
				break
			}

			// Embeds to markdown notes or PDFs become links
			case 'obsidianVaultUrl':
			case 'localFileUrl': {
				absolutePathOrUrl = node.properties.src
				break
			}

			case 'remoteHttpUrl': {
				absolutePathOrUrl = node.properties.src
				break
			}

			case 'localFilePath': {
				// The src will be URI-encoded at this point, which we don't want for local files
				// Local file URLs must be converted into paths before decoding, and must be absolute
				// already so they are not resolved
				absolutePathOrUrl = safeDecodeURI(node.properties.src)
				if (absolutePathOrUrl === undefined) {
					return CONTINUE
				}

				// Ignore any query parameters on local files
				absolutePathOrUrl = getBase(absolutePathOrUrl)

				break
			}
		}

		// Run these after visit since visit can not be asynchronous
		treeMutationPromises.push(async () => {
			// No matter what, we need to know the asset's extension to decide if it's
			// going in an <img> or a <span>[sound:...]</span> element (TODO due to
			// fetch lookups, this has performance implications for remoteHttpUrl
			// images...)
			const extension = await getAnkiMediaFilenameExtension(absolutePathOrUrl, fetchAdapter)

			// If unsupported, we shouldn't sync it or generate a safe hashed filename
			const supportedMedia =
				extension !== undefined &&
				srcType !== 'unsupportedProtocolUrl' &&
				srcType !== 'localFileName' &&
				srcType !== 'obsidianVaultUrl' &&
				srcType !== 'localFileUrl'

			// Never sync if extension can't be resolved...
			const yankiSyncMedia: boolean =
				((srcType === 'localFilePath' && syncMediaAssets === 'local') ||
					(srcType === 'remoteHttpUrl' && syncMediaAssets === 'remote') ||
					syncMediaAssets === 'all') &&
				supportedMedia

			// If we're trying to manage the asset, try to hash it and get a safe
			// filename for subsequent storage in the anki media system (otherwise undefined)
			// This also does an existence check. This is expensive, so we only do it
			// if we must.
			const ankiMediaFilename = yankiSyncMedia
				? await getSafeAnkiMediaFilename(
						absolutePathOrUrl,
						namespace,
						extension,
						fileAdapter,
						fetchAdapter,
					)
				: undefined

			const finalSrc = ankiMediaFilename ?? absolutePathOrUrl

			// Never sync assets we can't infer the type of...
			const syncEnabled: string =
				yankiSyncMedia && ankiMediaFilename !== undefined ? 'true' : 'false'

			if (
				!supportedMedia ||
				(MEDIA_SUPPORTED_FILE_EXTENSIONS as unknown as string[]).includes(extension)
			) {
				// Unsupported extensions, or PDF / Markdown file "embeds"

				// Links are a special case, where we DO potentially want queries on
				// local files

				const finalSourceWithQuery = isUrl(finalSrc)
					? finalSrc
					: `${finalSrc}${getQuery(String(node.properties.dataYankiSrcOriginal))}`

				parent.children.splice(
					index,
					1,
					u(
						'element',
						{
							properties: {
								className: [
									'yanki-media',
									`yanki-media-${supportedMedia ? 'file' : 'unsupported'}`,
								],
								'data-yanki-alt-text': node.properties.alt, // If available, why not keep it
								'data-yanki-media-src': absolutePathOrUrl, // Where Anki should grab the media
								'data-yanki-media-sync': syncEnabled, // Can theoretically be true if PDF or MD file
								'data-yanki-src': finalSrc, // What anki should call the media
								'data-yanki-src-original': node.properties.dataYankiSrcOriginal, // Pre-resolved URL, useful for debugging wiki links
							},
							tagName: 'span',
						},
						[
							u(
								'element',
								{
									properties: {
										href: finalSourceWithQuery,
									},
									tagName: 'a',
								},
								[u('text', String(node.properties.dataYankiSrcOriginal))],
							),
						],
					),
				)
			} else if ((MEDIA_SUPPORTED_IMAGE_EXTENSIONS as unknown as string[]).includes(extension)) {
				// Image
				//
				// Width and height will be set later
				node.properties.src = finalSrc
				node.properties.className = ['yanki-media', 'yanki-media-image']
				node.properties.dataYankiMediaSrc = absolutePathOrUrl
				node.properties.dataYankiMediaSync = syncEnabled
			} else if (
				(MEDIA_SUPPORTED_AUDIO_VIDEO_EXTENSIONS as unknown as string[]).includes(extension)
			) {
				// Audio or video
				//
				// Replace the current img node with a span containing the weirdo Anki
				// media embedding syntax
				//
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
								'data-yanki-media-src': absolutePathOrUrl,
								'data-yanki-media-sync': syncEnabled,
								'data-yanki-src': finalSrc,
								'data-yanki-src-original': node.properties.dataYankiSrcOriginal,
							},
							tagName: 'span',
						},
						[u('text', `[sound:${finalSrc}]`)],
					),
				)
			}
		})
	})

	// Run the tree mutation promises over the <img> nodes
	for (const mutationPromise of treeMutationPromises) {
		await mutationPromise()
	}

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

	// Check for emptiness...
	const isEmpty = isVisuallyEmpty(hastWithClass)

	// Return early if empty
	if (isEmpty && !useEmptyPlaceholder) {
		return ''
	}

	const nonEmptyHast = isEmpty
		? addFirstChildToFirstDiv(hastWithClass, NOTE_DEFAULT_EMPTY_HAST)
		: hastWithClass

	const html = processor.stringify(nonEmptyHast)

	// Add comment, we do this manually here instead of in an AST because
	// rehype-format does not add a line break after the comments
	return addBoilerplateComment(html).trim()
}

const htmlProcessor = unified().use(rehypeParse, { fragment: true })

function addBoilerplateComment(html: string): string {
	const boilerplate = `This HTML was generated by Yanki, a Markdown to Anki converter. Do not edit directly.`
	return `<!-- ${boilerplate} -->\n${html}`
}

function hastToPlainText(hast: HastRoot): string {
	return toText(hast)
}

function htmlToPlainText(html: string): string {
	const hast = htmlProcessor.parse(html)
	return hastToPlainText(hast)
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
			// This has to be camel case...
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

/**
 * Determine if a HAST tree is visually empty.
 * @param {Node} tree - The HAST tree to check.
 * @returns {boolean} - True if the tree is visually empty, otherwise false.
 */
function isVisuallyEmpty(tree: HastRoot): boolean {
	let hasVisualContent = false

	visit(tree, (node) => {
		if (hasVisualContent) return // Early exit if visual content is found

		if (node.type === 'element') {
			const element = node
			const { tagName } = element

			// Check for visually meaningful tags
			// TODO vet that Anki agrees these are all 'real' non-empty content
			const visuallyMeaningfulTags = [
				'img',
				'video',
				'audio',
				'iframe',
				'object',
				'embed',
				'canvas',
				'svg',
				'picture',
			]
			if (visuallyMeaningfulTags.includes(tagName)) {
				hasVisualContent = true
				return EXIT
			}

			// Check if the element has text content
			const textContent = toText(element).trim()
			if (textContent) {
				hasVisualContent = true
				return EXIT
			}
		}

		if (node.type === 'text' && node.value !== undefined && node.value.trim() !== '') {
			hasVisualContent = true
			return EXIT
		}
	})

	return !hasVisualContent
}

/**
 * Add a first child to the first div element in a HAST tree.
 * Intended for use with the "div-wrapped" HAST tree generated early in `mdastToHtml`.
 * @param tree - The HAST tree to modify in place.
 * @param newChild - The new child node to add.
 * @returns - The modified-in-place HAST tree.
 */
function addFirstChildToFirstDiv(tree: HastRoot, newChild: ElementContent): HastRoot {
	visit(tree, 'element', (node: Element) => {
		if (node.tagName === 'div') {
			node.children.unshift(newChild)
			return EXIT
		}
	})

	return tree
}

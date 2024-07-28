import { detectVault } from '../src/bin/utilities/obsidian'
import { getNoteFromMarkdown, syncFiles } from '../src/lib/index'
//
import { getBase, stripBasePath } from '../src/lib/utilities/path'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { globby } from 'globby'
import { HTMLElement, parseHTML } from 'linkedom'
// Import { getAnkiMediaTags, getAttributesOfAllNodes } from './utilities/dom-inspector'
import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'

it('detects obsidian vault', async () => {
	expect(await detectVault('./test/assets/test-obsidian-vault')).toBeDefined()
	expect(await detectVault('./test/assets/test-obsidian-vault/')).toBeDefined()
	expect(await detectVault('./test/assets/test-obsidian-vault/Cards/Group 1/')).toBeDefined()
	expect(await detectVault('./test/assets/test-obsidian-vault/Cards/Group 1')).toBeDefined()
	expect(
		await detectVault('./test/assets/test-obsidian-vault/Cards/Group 1/test card.md'),
	).toBeDefined()
})

it('detects absence of obsidian vault', async () => {
	expect(await detectVault('./test/assets/test-media')).toBeUndefined()
	expect(await detectVault('./test/assets/test-media/')).toBeUndefined()
	expect(await detectVault('./test/assets/test-media/image')).toBeUndefined()
	expect(await detectVault('./test/assets/test-media/image/')).toBeUndefined()
	expect(await detectVault('./test/assets/test-media/audio/yanki.3gp')).toBeUndefined()
})

// TODO: 34 failures ATM
// TODO issue with obsidian links?
it('correctly resolves obsidian wiki links', async () => {
	const notesToTest = [
		'./test/assets/test-obsidian-vault/Wiki Links/test card.md',
		'./test/assets/test-obsidian-vault/Wiki Links/Nested/test card.md',
		'./test/assets/test-obsidian-vault/Wiki Links/Nested/Nested/test card.md',
	]

	const allFilePaths = await globby('./test/assets/test-obsidian-vault/**/*', { absolute: true })

	//
	// console.log('----------------------------------')
	// console.log(allFilePaths)

	let failCount = 0
	let total = 0

	const basePath = `${path.posix.resolve('./test/assets/test-obsidian-vault')}`

	for (const file of notesToTest) {
		const markdown = await fs.readFile(file, 'utf8')

		const noteResolved = await getNoteFromMarkdown(markdown, {
			allFilePaths,
			basePath,
			cwd: path.posix.dirname(path.posix.resolve(file)),
			namespace: 'test',
			obsidianVault: 'test-obsidian-vault',
			syncMediaAssets: 'off',
		})

		const noteHtml = `${noteResolved.fields.Front}${noteResolved.fields.Back}`
		const { document } = parseHTML(noteHtml)
		const elements = document.querySelectorAll('[data-yanki-src-original]')

		for (const element of elements) {
			// Ensure element is an instance of Element
			if (!(element instanceof HTMLElement)) {
				throw new TypeError('Unexpected element')
			}

			// Type assertion to specify element.dataset is a DOMStringMap
			const dataset = element.dataset as DOMStringMap

			const originalSrc = decodeURI(dataset.yankiSrcOriginal ?? '')

			const resolvedSrc =
				dataset.yankiMediaSrc ?? element.getAttribute('href') ?? element.getAttribute('src') ?? ''
			const expectedSrc = element.getAttribute('alt') ?? element.innerHTML

			// Clean up for comparison
			const expectedSrcClean = path.posix.normalize(
				getBase(stripBasePath(convertObsidianUrlToFilePath(expectedSrc), basePath)).toLowerCase(),
			)
			const resolvedSrcClean = decodeURI(
				path.posix
					.normalize(getBase(stripBasePath(convertObsidianUrlToFilePath(resolvedSrc), basePath)))
					.toLowerCase()
					.replace('test/assets/test-obsidian-vault', '')
					.replace('/users/mika/code/yanki/', ''),
			)

			//
			// expect(resolvedSrcClean).toEqual(expectedSrcClean)
			total++
			if (resolvedSrcClean !== expectedSrcClean) {
				failCount++
				console.log('----------------------------------')
				console.log(`expectedSrc: ${expectedSrc}`)
				console.log(`originalSrc: ${originalSrc}`)
				console.log(`resolvedSrc: ${resolvedSrc}`)
				console.log(`expectedSrcClean: ${expectedSrcClean}`)
				console.log(`resolvedSrcClean: ${resolvedSrcClean}`)
			}
		}
	}

	console.log('----------------------------------')
	console.log(`fails: ${failCount} / ${total}`)
})

// Debug
// it('single file test', async () => {
// 	// Const markdown = await fs.readFile(
// 	// 	'./test/assets/test-obsidian-vault/Cards/Markdown/links.md',
// 	// 	'utf8',
// 	// )

// 	const md = String.raw`[asd|stuff|more-stuff|100x100](<test card>)`
// 	console.log(md)
// 	const note = await getNoteFromMarkdown(md, {
// 		basePath: './test/assets/test-obsidian-vault',
// 		cwd: './test/assets/test-obsidian-vault/Cards/Markdown',
// 		namespace: 'test',
// 		obsidianVault: 'test-obsidian-vault',
// 		syncMediaAssets: 'off',
// 	})

// 	console.log('----------------------------------')
// 	console.log(note.fields.Front)
// })

describeWithFileFixture(
	'obsidian vault',
	{
		assetPath: './test/assets/test-obsidian-vault/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('correctly syncs an entire obsidian vault', { timeout: 60_000 }, async () => {
			// Assumes vault has been opened at least once!
			const obsidianVaultInfo = await detectVault(context.assetPath)
			if (!obsidianVaultInfo) {
				throw new Error(
					"Obsidian vault not found, make sure you've opened it at least once on this machine.",
				)
			}

			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				basePath: context.tempAssetPath,
				dryRun: false,
				manageFilenames: 'off',
				namespace: context.namespace,
				obsidianVault: obsidianVaultInfo.name,
				syncMediaAssets: 'off',
			})

			expect(results).toBeDefined()
		})

		// It('correctly resolves obsidian wiki links', async () => {
		// 	// This gets its own test because it's so tricky to get right

		// 	// Assumes vault has been opened at least once!
		// 	const obsidianVaultInfo = await detectVault(context.assetPath)
		// 	if (!obsidianVaultInfo) {
		// 		throw new Error(
		// 			"Obsidian vault not found, make sure you've opened it at least once on this machine.",
		// 		)
		// 	}

		// 	const report: LinkResolutionReportEntry[] = []

		// 	// Convert Markdown to Anki notes
		// 	for (const file of context.markdownFiles) {
		// 		const markdown = await fs.readFile(file, 'utf8')

		// 		const noteSettings: Partial<GetNoteFromMarkdownOptions> = {
		// 			allFilePaths: context.allFiles,
		// 			basePath: context.tempAssetPath,
		// 			cwd: path.posix.dirname(file),
		// 			namespace: context.namespace,
		// 			namespaceValidationAndSanitization: true,
		// 			obsidianVault: obsidianVaultInfo.name,
		// 			syncMediaAssets: 'off',
		// 		}

		// 		// First Pass does NOT resolve links, so we have a baseline of the original links
		// 		const noteUnresolved = await getNoteFromMarkdown(markdown, {
		// 			...noteSettings,
		// 			resolveUrls: false,
		// 		})

		// 		const reportUnresolved = getLinkResolutionReport(
		// 			file,
		// 			`${noteUnresolved.fields.Front}${noteUnresolved.fields.Back}`,
		// 		)

		// 		// Second pass DOES resolve links, so we can compare
		// 		const noteResolved = await getNoteFromMarkdown(markdown, {
		// 			...noteSettings,
		// 			resolveUrls: true,
		// 		})

		// 		const reportResolved = getLinkResolutionReport(
		// 			file,
		// 			`${noteResolved.fields.Front}${noteResolved.fields.Back}`,
		// 		)

		// 		for (const [i, entryUnresolved] of reportUnresolved.entries()) {
		// 			const entryResolved = reportResolved[i]

		// 			// Rewrite base path for stability
		// 			report.push({
		// 				file: entryUnresolved.file.replace(context.tempAssetPath, '/base/path'),
		// 				type: entryUnresolved.type,
		// 				urlOriginal: entryUnresolved.urlOriginal?.replace(context.tempAssetPath, '/base/path'),
		// 				urlResolved: entryResolved.urlResolved?.replace(context.tempAssetPath, '/base/path'),
		// 			})
		// 		}
		// 	}

		// 	expect(report).toMatchSnapshot()
		// })
	},
)

// ----------------------------------

// Helpers

// type LinkResolutionReportEntry = {
// 	file: string
// 	type: 'img' | 'link' | 'media'
// 	urlOriginal: string | undefined
// 	urlResolved: string | undefined
// }

// function getLinkResolutionReport(file: string, html: string): LinkResolutionReportEntry[] {
// 	const imgAttributes = getAttributesOfAllNodes(html, 'img').filter(
// 		(img) => img['data-yanki-sync-media'] !== undefined,
// 	)

// 	const linkAttributes = getAttributesOfAllNodes(html, 'a').filter(
// 		(a) => a['data-yanki-sync-media'] !== undefined,
// 	)

// 	const mediaTags = getAnkiMediaTags(html)

// 	const report: LinkResolutionReportEntry[] = []

// 	for (const img of imgAttributes) {
// 		report.push({
// 			file,
// 			type: 'img',
// 			urlOriginal: img.src,
// 			urlResolved: img.src,
// 		})
// 	}

// 	for (const link of linkAttributes) {
// 		report.push({
// 			file,
// 			type: 'link',
// 			urlOriginal: link.href,
// 			urlResolved: link.href,
// 		})
// 	}

// 	for (const mediaTag of mediaTags) {
// 		report.push({
// 			file,
// 			type: 'media',
// 			urlOriginal: mediaTag,
// 			urlResolved: mediaTag,
// 		})
// 	}

// 	return report
// }

function convertObsidianUrlToFilePath(url: string): string {
	// Parse the URL
	let urlObject: URL
	try {
		urlObject = new URL(url)
	} catch {
		return url
	}

	// Ensure the URL is an obsidian://open type
	if (urlObject.protocol !== 'obsidian:' || urlObject.hostname !== 'open') {
		return url
	}

	// Extract the vault and file parameters
	const vault = urlObject.searchParams.get('vault')
	const file = urlObject.searchParams.get('file')

	if (!vault || !file) {
		console.warn('Missing required parameters')
		return url
	}

	// Decode the file path
	const decodedFilePath = decodeURIComponent(file)

	// Return the decoded file path
	return decodedFilePath
}

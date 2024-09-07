import { globby } from 'globby'
import { HTMLElement, parseHTML } from 'linkedom'
import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'
import { detectVault } from '../src/bin/utilities/obsidian'
import { getNoteFromMarkdown, syncFiles } from '../src/lib/index'
import { getBase, normalize, stripBasePath } from '../src/lib/utilities/path'
import { parseObsidianVaultLink } from '../src/lib/utilities/resolve-link'
import { safeDecodeURI } from '../src/lib/utilities/url'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { stripAnkiMediaTag } from './utilities/dom-inspector'
import { stableResults } from './utilities/stable-sync-results'

it('detects obsidian vault', async () => {
	// Assumes vault has been opened at least once on this machine!
	expect(await detectVault('./test/assets/test-obsidian-vault')).toBeDefined()
	expect(await detectVault('./test/assets/test-obsidian-vault/')).toBeDefined()
	expect(await detectVault('./test/assets/test-obsidian-vault/Cards/Group 1/')).toBeDefined()
	expect(await detectVault('./test/assets/test-obsidian-vault/Cards/Group 1')).toBeDefined()
	expect(
		await detectVault('./test/assets/test-obsidian-vault/Cards/Group 1/test card.md'),
	).toBeDefined()
})

it('detects absence of obsidian vault', async () => {
	// Assumes vault has been opened at least once on this machine!
	expect(await detectVault('./test/assets/test-media')).toBeUndefined()
	expect(await detectVault('./test/assets/test-media/')).toBeUndefined()
	expect(await detectVault('./test/assets/test-media/image')).toBeUndefined()
	expect(await detectVault('./test/assets/test-media/image/')).toBeUndefined()
	expect(await detectVault('./test/assets/test-media/audio/yanki.3gp')).toBeUndefined()
})

it('correctly resolves obsidian wiki links', async () => {
	// Notes have been specially prepared with the correct Obsidian-resolved link
	// path in their alt text or innerHTML text
	const notesToTestRaw = [
		'./test/assets/test-obsidian-vault/Wiki Links/test card.md',
		'./test/assets/test-obsidian-vault/Wiki Links/Nested/test card.md',
		'./test/assets/test-obsidian-vault/Wiki Links/Nested/Nested/test card.md',
	]

	const notesToTest = notesToTestRaw.map((file) => normalize(path.resolve(file)))

	const allFilePathsRaw = await globby('./test/assets/test-obsidian-vault/**/*', { absolute: true })
	const allFilePaths = allFilePathsRaw.map((file) => normalize(file))
	const basePath = normalize(path.resolve('./test/assets/test-obsidian-vault'))

	for (const file of notesToTest) {
		const markdown = await fs.readFile(file, 'utf8')

		const noteResolved = await getNoteFromMarkdown(markdown, {
			allFilePaths,
			basePath,
			cwd: normalize(path.dirname(file)),
			namespace: 'test',
			obsidianVault: 'test-obsidian-vault',
			syncMediaAssets: 'off',
		})

		const noteHtml = `${noteResolved.fields.Front}${noteResolved.fields.Back}`
		checkWikiLinkResolution(noteHtml, basePath)
	}
})

describeWithFileFixture(
	'obsidian vault sync',
	{
		assetPath: './test/assets/test-obsidian-vault/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('correctly syncs an entire obsidian vault', { timeout: 60_000 }, async () => {
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
				obsidianVault: 'test-obsidian-vault',
				syncMediaAssets: 'all',
			})

			// Valid wiki links
			for (const result of results.synced) {
				if (
					result.filePathOriginal?.includes('/Wiki Links/') &&
					result.filePathOriginal?.endsWith('test card.md')
				) {
					const html = `${result.note.fields.Front}${result.note.fields.Back}`
					checkWikiLinkResolution(html, normalize(context.tempAssetPath))
				}
			}

			// Basic stability
			expect(stableResults(results)).toMatchSnapshot()
		})
	},
)

describeWithFileFixture(
	'obsidian vault wiki link stability',
	{
		assetPath: './test/assets/test-obsidian-vault/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('correctly syncs an entire obsidian vault', { timeout: 60_000 }, async () => {
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				basePath: context.tempAssetPath,
				dryRun: false,
				manageFilenames: 'prompt',
				namespace: context.namespace,
				obsidianVault: 'test-obsidian-vault',
				syncMediaAssets: 'off',
			})

			// Valid wiki links
			// TODO revisit this after link updating is implemented
			for (const result of results.synced) {
				if (
					result.filePathOriginal?.includes('/Wiki Links/') &&
					result.filePathOriginal?.endsWith('test card.md')
				) {
					// Debug
					// console.log(`Checking: ${result.filePathOriginal} which is now ${result.filePath}`)
					const html = `${result.note.fields.Front}${result.note.fields.Back}`
					checkWikiLinkResolution(html, normalize(context.tempAssetPath))
				}
			}

			// Basic stability
			expect(stableResults(results)).toMatchSnapshot()
		})
	},
)

function checkWikiLinkResolution(html: string, basePath: string): void {
	const { document } = parseHTML(html)
	const elements = document.querySelectorAll('[data-yanki-src-original]')

	for (const element of elements) {
		// Ensure element is an instance of Element
		if (!(element instanceof HTMLElement)) {
			continue
		}

		// Type assertion to specify element.dataset is a DOMStringMap
		const dataset = element.dataset as DOMStringMap

		const originalSrc = safeDecodeURI(dataset.yankiSrcOriginal ?? '')

		const resolvedSrc =
			dataset.yankiMediaSrc ?? element.getAttribute('href') ?? element.getAttribute('src') ?? ''
		const expectedSrc = element.getAttribute('alt') ?? dataset.yankiAltText ?? element.innerHTML

		// Clean up for comparison, handling Obsidian vault links if present
		const srcPathFromVaultLink = parseObsidianVaultLink(expectedSrc)?.linkPath ?? expectedSrc

		const expectedSrcClean = path.posix.normalize(
			getBase(stripBasePath(stripAnkiMediaTag(srcPathFromVaultLink), basePath)).toLowerCase(),
		)

		const resolvedSrcPathFromVaultLink =
			parseObsidianVaultLink(resolvedSrc)?.linkPath ?? resolvedSrc

		const resolvedSrcClean = safeDecodeURI(
			path.posix
				.normalize(getBase(stripBasePath(resolvedSrcPathFromVaultLink, basePath)))
				.toLowerCase()
				.replace('test/assets/test-obsidian-vault', '')
				.replace('c:/users/mika/code/yanki/', '')
				.replace('/users/mika/code/yanki/', ''),
		)

		expect(resolvedSrcClean, `Original link source: "${originalSrc}"`).toEqual(expectedSrcClean)
	}
}

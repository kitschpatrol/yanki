import { detectVault } from '../src/bin/utilities/obsidian'
import { type GetNoteFromMarkdownOptions, getNoteFromMarkdown, syncFiles } from '../src/lib/index'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { getAnkiMediaTags, getAttributesOfAllNodes } from './utilities/dom-inspector'
import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('detect obsidian vault', () => {
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
})

// Debug
// it('single file test', async () => {
// 	// Const markdown = await fs.readFile(
// 	// 	'./test/assets/test-obsidian-vault/Cards/Markdown/links.md',
// 	// 	'utf8',
// 	// )

// 	const md = String.raw`[asd|adfasdf|asdfasdf|100x100](<test card>)`
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
		cleanUpAnki: false, // TODO
		cleanUpTempFiles: false,
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
				syncMediaAssets: 'all',
			})

			expect(results).toBeDefined()
		})

		it('correctly resolves obsidian wiki links', async () => {
			// This gets its own test because it's so tricky to get right

			// Assumes vault has been opened at least once!
			const obsidianVaultInfo = await detectVault(context.assetPath)
			if (!obsidianVaultInfo) {
				throw new Error(
					"Obsidian vault not found, make sure you've opened it at least once on this machine.",
				)
			}

			const report: LinkResolutionReportEntry[] = []

			// Convert Markdown to Anki notes
			for (const file of context.markdownFiles) {
				const markdown = await fs.readFile(file, 'utf8')

				const noteSettings: Partial<GetNoteFromMarkdownOptions> = {
					allFilePaths: context.allFiles,
					basePath: context.tempAssetPath,
					cwd: path.dirname(file),
					namespace: context.namespace,
					namespaceValidationAndSanitization: true,
					obsidianVault: obsidianVaultInfo.name,
					syncMediaAssets: 'off',
				}

				// First Pass does NOT resolve links, so we have a baseline of the original links
				const noteUnresolved = await getNoteFromMarkdown(markdown, {
					...noteSettings,
					resolveUrls: false,
				})

				const reportUnresolved = getLinkResolutionReport(
					file,
					`${noteUnresolved.fields.Front}${noteUnresolved.fields.Back}`,
				)

				// Second pass DOES resolve links, so we can compare
				const noteResolved = await getNoteFromMarkdown(markdown, {
					...noteSettings,
					resolveUrls: true,
				})

				const reportResolved = getLinkResolutionReport(
					file,
					`${noteResolved.fields.Front}${noteResolved.fields.Back}`,
				)

				for (const [i, entryUnresolved] of reportUnresolved.entries()) {
					const entryResolved = reportResolved[i]

					// Rewrite base path for stability
					report.push({
						file: entryUnresolved.file.replace(context.tempAssetPath, '/base/path'),
						type: entryUnresolved.type,
						urlOriginal: entryUnresolved.urlOriginal?.replace(context.tempAssetPath, '/base/path'),
						urlResolved: entryResolved.urlResolved?.replace(context.tempAssetPath, '/base/path'),
					})
				}
			}

			console.log('\n----------------------------------')
			console.log(report)
		})
	},
)

type LinkResolutionReportEntry = {
	file: string
	type: 'img' | 'link' | 'media'
	urlOriginal: string | undefined
	urlResolved: string | undefined
}

function getLinkResolutionReport(file: string, html: string): LinkResolutionReportEntry[] {
	const imgAttributes = getAttributesOfAllNodes(html, 'img')
	const linkAttributes = getAttributesOfAllNodes(html, 'a')
	const mediaTags = getAnkiMediaTags(html)

	const report: LinkResolutionReportEntry[] = []

	for (const img of imgAttributes) {
		report.push({
			file,
			type: 'img',
			urlOriginal: img.src,
			urlResolved: img.src,
		})
	}

	for (const link of linkAttributes) {
		report.push({
			file,
			type: 'link',
			urlOriginal: link.href,
			urlResolved: link.href,
		})
	}

	for (const mediaTag of mediaTags) {
		report.push({
			file,
			type: 'media',
			urlOriginal: mediaTag,
			urlResolved: mediaTag,
		})
	}

	return report
}

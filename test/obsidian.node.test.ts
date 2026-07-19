import { globby } from 'globby'
import { HTMLElement, parseHTML } from 'linkedom'
import nodeFs from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { detectVault } from '../src/bin/utilities/obsidian'
import { getNoteFromMarkdown, syncFiles } from '../src/lib/index'
import { getBase, normalize, stripBasePath } from '../src/lib/utilities/path'
import { PLATFORM } from '../src/lib/utilities/platform'
import { parseObsidianVaultLink } from '../src/lib/utilities/resolve-link'
import { safeDecodeURI } from '../src/lib/utilities/url'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { stripAnkiMediaTag } from './utilities/dom-inspector'
import { stableResults } from './utilities/stable-sync-results'

// Vault detection tests require Obsidian to have opened the vault at least once
const obsidianConfigDirectory =
	PLATFORM === 'windows'
		? String.raw`${process.env.APPDATA}\Obsidian`
		: PLATFORM === 'mac'
			? `${process.env.HOME}/Library/Application Support/obsidian`
			: `${process.env.XDG_CONFIG_HOME ?? `${process.env.HOME}/.config`}/Obsidian`
const isObsidianInstalled = nodeFs.existsSync(obsidianConfigDirectory)

it.skipIf(!isObsidianInstalled)('detects obsidian vault', async () => {
	// Assumes vault has been opened at least once on this machine!
	expect(await detectVault('./test/assets/test-obsidian-vault')).toBeDefined()
	expect(await detectVault('./test/assets/test-obsidian-vault/')).toBeDefined()
	expect(await detectVault('./test/assets/test-obsidian-vault/Cards/Group 1/')).toBeDefined()
	expect(await detectVault('./test/assets/test-obsidian-vault/Cards/Group 1')).toBeDefined()
	expect(
		await detectVault('./test/assets/test-obsidian-vault/Cards/Group 1/test card.md'),
	).toBeDefined()
})

it.skipIf(!isObsidianInstalled)('detects absence of obsidian vault', async () => {
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

	const allFilePathsRaw = await globby('**/*', {
		absolute: true,
		cwd: './test/assets/test-obsidian-vault',
	})
	allFilePathsRaw.sort()
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

		const noteHtml = `${noteResolved.fields.Front}${noteResolved.fields.Back}${noteResolved.fields.Extra}`
		checkWikiLinkResolution(noteHtml, basePath)
	}
})

// Question marks are valid in note file names on macOS and Linux, but not on
// Windows, so the "?" file name is created by renaming at test time — a
// committed "?" in a path would break git checkout on Windows CI runners.
// https://github.com/kitschpatrol/yanki-obsidian/issues/75
it.skipIf(PLATFORM === 'windows')(
	'resolves links to notes with question marks in their file names',
	async () => {
		const tempAssetPath = normalize(
			path.join(os.tmpdir(), `yanki-test-${Date.now()}`, 'test-question-mark'),
		)
		// eslint-disable-next-line node/no-unsupported-features/node-builtins
		await fs.cp('./test/assets/test-question-mark', tempAssetPath, {
			preserveTimestamps: true,
			recursive: true,
		})
		await fs.rename(
			path.join(tempAssetPath, 'Cards/How much is 2+2=.md'),
			path.join(tempAssetPath, 'Cards/How much is 2+2=?.md'),
		)

		try {
			const noteFile = path.join(tempAssetPath, 'Cards/How much is 2+2=?.md')

			const allFilePathsRaw = await globby('**/*', {
				absolute: true,
				cwd: tempAssetPath,
			})
			allFilePathsRaw.sort()
			const allFilePaths = allFilePathsRaw.map((file) => normalize(file))

			const markdown = await fs.readFile(noteFile, 'utf8')

			const note = await getNoteFromMarkdown(markdown, {
				allFilePaths,
				basePath: tempAssetPath,
				cwd: normalize(path.dirname(noteFile)),
				namespace: 'test',
				obsidianVault: 'test-question-mark',
				syncMediaAssets: 'off',
			})

			const html = `${note.fields.Front}${note.fields.Back}${note.fields.Extra}`
			const { document } = parseHTML(html)
			const links = [...document.querySelectorAll('a[data-yanki-src-original]')]

			// The note links to itself twice, once by vault-root-relative path and
			// once by bare wiki name
			expect(links).toHaveLength(2)

			const expectedHref = `obsidian://open?vault=test-question-mark&file=${encodeURIComponent('/Cards/How much is 2+2=?.md')}`
			for (const link of links) {
				expect(link.getAttribute('href')).toBe(expectedHref)
			}
		} finally {
			await fs.rm(path.dirname(tempAssetPath), { force: true, recursive: true })
		}
	},
)

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
					autoLaunch: false,
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
					!result.filePathOriginal?.includes('/Wiki Links/') ||
					!result.filePathOriginal.endsWith('test card.md')
				) {
					continue
				}

				const html = `${result.note.fields.Front}${result.note.fields.Back}${result.note.fields.Extra}`
				checkWikiLinkResolution(html, normalize(context.tempAssetPath))
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
		it(
			'correctly syncs an entire obsidian vault with managed filenames',
			{ timeout: 60_000 },
			async () => {
				const results = await syncFiles(context.markdownFiles, {
					allFilePaths: context.allFiles,
					ankiConnectOptions: {
						autoLaunch: false,
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
				// TODO revisit this if link updating is implemented
				// for (const result of results.synced) {
				// 	if (
				// 		result.filePathOriginal?.includes('/Wiki Links/') &&
				// 		result.filePathOriginal.endsWith('test card.md')
				// 	) {
				// 		// Debug
				// 		console.log(`Checking: ${result.filePathOriginal} which is now ${result.filePath}`)
				// 		const html = `${result.note.fields.Front}${result.note.fields.Back}${result.note.fields.Extra}`
				// 		checkWikiLinkResolution(html, normalize(context.tempAssetPath))
				// 	}
				// }

				// Basic stability
				expect(stableResults(results)).toMatchSnapshot()
			},
		)
	},
)

// The two notes in this fixture are named so that managed renaming inverts
// their sort order: 'aa first.md' → 'Zebra prompt.md' and 'zz last.md' →
// 'Apple prompt.md'. The Obsidian note reload in syncFiles pairs reloaded
// notes with renamed notes by index, which is only safe if renameNotes and
// loadLocalNotes agree on sort order.
describeWithFileFixture(
	'obsidian reload pairing when renames change sort order',
	{
		assetPath: './test/assets/test-rename-order/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it(
			'pairs reloaded notes with the correct files when renames invert file sort order',
			{ timeout: 60_000 },
			async () => {
				const results = await syncFiles(context.markdownFiles, {
					allFilePaths: context.allFiles,
					ankiConnectOptions: {
						autoLaunch: false,
					},
					ankiWeb: false,
					basePath: context.tempAssetPath,
					dryRun: false,
					manageFilenames: 'prompt',
					namespace: context.namespace,
					obsidianVault: 'test-rename-order',
					syncMediaAssets: 'off',
				})

				const zebra = results.synced.find((result) =>
					result.filePathOriginal?.endsWith('aa first.md'),
				)
				const apple = results.synced.find((result) =>
					result.filePathOriginal?.endsWith('zz last.md'),
				)

				// Sanity: the renames happened and inverted the files' sort order
				expect(zebra?.filePath?.endsWith('Zebra prompt.md')).toBe(true)
				expect(apple?.filePath?.endsWith('Apple prompt.md')).toBe(true)

				// Each synced entry's note must be the note parsed from its own
				// file, not from the neighbor that swapped sort positions with it
				expect(zebra?.note.fields.Front).toContain('Zebra prompt')
				expect(apple?.note.fields.Front).toContain('Apple prompt')

				// And on disk, each renamed file must still hold its own content
				const zebraMarkdown = await fs.readFile(zebra!.filePath!, 'utf8')
				const appleMarkdown = await fs.readFile(apple!.filePath!, 'utf8')
				expect(zebraMarkdown).toContain('Zebra prompt')
				expect(appleMarkdown).toContain('Apple prompt')
			},
		)
	},
)

describeWithFileFixture(
	'obsidian dry-run rename reload',
	{
		assetPath: './test/assets/test-rename-order/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it(
			'reloads notes without reading renamed paths that were never created during a dry run',
			{ timeout: 60_000 },
			async () => {
				// A dry run skips the on-disk renames, but still reports the new
				// file paths, so the Obsidian note reload must not read from them
				const results = await syncFiles(context.markdownFiles, {
					allFilePaths: context.allFiles,
					ankiConnectOptions: {
						autoLaunch: false,
					},
					ankiWeb: false,
					basePath: context.tempAssetPath,
					dryRun: true,
					manageFilenames: 'prompt',
					namespace: context.namespace,
					obsidianVault: 'test-rename-order',
					syncMediaAssets: 'off',
				})

				expect(results.synced).toHaveLength(2)
			},
		)
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
		// eslint-disable-next-line unicorn/prefer-dom-node-html-methods
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

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

it('resolves slash and Unicode heading links', async () => {
	const vaultPath = normalize(path.resolve('./test/assets/test-link-encoding'))
	const noteFile = normalize(path.join(vaultPath, 'Cards/✓Test Card 1.md'))
	const allFilePathsRaw = await globby('**/*', {
		absolute: true,
		cwd: vaultPath,
	})
	const allFilePaths = allFilePathsRaw.toSorted().map((file) => normalize(file))
	const markdown = await fs.readFile(noteFile, 'utf8')
	const note = await getNoteFromMarkdown(markdown, {
		allFilePaths,
		basePath: vaultPath,
		cwd: normalize(path.dirname(noteFile)),
		namespace: 'test',
		obsidianVault: 'test-link-encoding',
		syncMediaAssets: 'off',
	})
	const { document } = parseHTML(`${note.fields.Front}${note.fields.Back}${note.fields.Extra}`)
	const links = Array.from(document.querySelectorAll('a'), (node) => node.href)

	/* Spell-checker:disable */
	expect(links).toMatchInlineSnapshot(`
		[
		  "obsidian://open?vault=test-link-encoding&file=%252FNotes%252FMobile%20Communication%20Protocols%20(Monolith%20Note).md%25232G%252FEDGE%20Heading",
		  "obsidian://open?vault=test-link-encoding&file=%252FNotes%252FMobile%20Communication%20Protocols%20(Monolith%20Note).md%2523%E2%9C%93%205G%252FLTE%20Heading",
		  "obsidian://open?vault=test-link-encoding&file=%252FCards%252F%E2%9C%93Test%20Card%201.md%2523Pareto%20Principle%20(80%252F20%20Rule)",
		  "obsidian://open?vault=test-link-encoding&file=%252FCards%252F%E2%9C%93Test%20Card%201.md%2523%E2%9C%93%20ISP's%20Gray%20IP%252FNAT%20Bypassing%20for%20self-hosting",
		]
	`)
	/* Spell-checker:enable */
})

// Question marks are valid in note file names on macOS and Linux, but not on
// Windows, so the "?" file name is created by renaming at test time — a
// committed "?" in a path would break git checkout on Windows CI runners.
//https://github.com/kitschpatrol/yanki/issues/20
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
		await fs.copyFile(
			'./test/assets/test-obsidian-vault/yanki image.jpg',
			path.join(tempAssetPath, 'Cards/question mark image?.jpg'),
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

			// Media embeds of files with question marks in their names must keep
			// the literal path in their media src
			const images = [...document.querySelectorAll('img[data-yanki-media-src]')]
			expect(images).toHaveLength(1)
			const [image] = images
			if (!(image instanceof HTMLElement)) {
				throw new TypeError('Expected image embed to be an HTMLElement')
			}

			expect((image.dataset as DOMStringMap).yankiMediaSrc).toBe(
				path.join(tempAssetPath, 'Cards/question mark image?.jpg'),
			)

			// With media syncing enabled, the question-mark asset must be found on
			// disk, hashed, and assigned a safe Anki media filename
			const noteSyncedMedia = await getNoteFromMarkdown(markdown, {
				allFilePaths,
				basePath: tempAssetPath,
				cwd: normalize(path.dirname(noteFile)),
				namespace: 'test',
				obsidianVault: 'test-question-mark',
				syncMediaAssets: 'local',
			})

			const htmlSyncedMedia = `${noteSyncedMedia.fields.Front}${noteSyncedMedia.fields.Back}${noteSyncedMedia.fields.Extra}`
			const { document: documentSyncedMedia } = parseHTML(htmlSyncedMedia)
			const syncedImages = [...documentSyncedMedia.querySelectorAll('img[data-yanki-media-src]')]
			expect(syncedImages).toHaveLength(1)
			const [syncedImage] = syncedImages
			if (!(syncedImage instanceof HTMLElement)) {
				throw new TypeError('Expected image embed to be an HTMLElement')
			}

			const syncedImageDataset = syncedImage.dataset as DOMStringMap

			// Sync is only marked true if the file at the literal "?" path was
			// actually found and content-hashed through the file adapter
			expect(syncedImageDataset.yankiMediaSync).toBe('true')

			// Anki fetches the asset from the literal path
			expect(syncedImageDataset.yankiMediaSrc).toBe(
				path.join(tempAssetPath, 'Cards/question mark image?.jpg'),
			)

			// The stored media filename is a hashed slug with no question mark
			const syncedImageSrc = syncedImage.getAttribute('src') ?? ''
			expect(syncedImageSrc.endsWith('.jpg')).toBe(true)
			expect(syncedImageSrc).not.toContain('?')
			expect(syncedImageSrc).not.toBe(syncedImageDataset.yankiMediaSrc)

			// Without a vault, links resolve to plain absolute paths, and the
			// question mark must be percent-encoded so the href parses as a path
			const notePlain = await getNoteFromMarkdown(markdown, {
				allFilePaths,
				basePath: tempAssetPath,
				cwd: normalize(path.dirname(noteFile)),
				namespace: 'test',
				syncMediaAssets: 'off',
			})

			const htmlPlain = `${notePlain.fields.Front}${notePlain.fields.Back}${notePlain.fields.Extra}`
			const { document: documentPlain } = parseHTML(htmlPlain)
			const linksPlain = [...documentPlain.querySelectorAll('a[data-yanki-src-original]')]
			expect(linksPlain).toHaveLength(2)

			const expectedPlainHref = encodeURI(normalize(noteFile)).replaceAll('?', '%3F')
			for (const link of linksPlain) {
				expect(link.getAttribute('href')).toBe(expectedPlainHref)
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

import { globby } from 'globby'
import path from 'path-browserify-esm'
import { expect, it } from 'vitest'
import { syncFiles } from '../src/lib'
import * as pathExtras from '../src/lib/utilities/path'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { cleanUpTempPath, stableResults } from './utilities/stable-sync-results'

describeWithFileFixture(
	'filename management',
	{
		assetPath: './test/assets/test-filename-management/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('uses the prompt as a filename', async () => {
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'prompt',
				namespace: context.namespace,
				syncMediaAssets: 'off',
			})

			const changeMap = new Map<string, string>()
			for (const { filePath, filePathOriginal } of results.synced) {
				expect(filePath).toBeDefined()
				expect(filePathOriginal).toBeDefined()
				changeMap.set(cleanUpTempPath(filePathOriginal)!, cleanUpTempPath(filePath)!)
			}

			expect(changeMap).toMatchInlineSnapshot(`
				Map {
				  "/test-filename-management/case-sensitivity/a.md" => "/test-filename-management/case-sensitivity/A (1).md",
				  "/test-filename-management/case-sensitivity/b.md" => "/test-filename-management/case-sensitivity/A (2).md",
				  "/test-filename-management/case-sensitivity/something-else.md" => "/test-filename-management/case-sensitivity/A (3).md",
				  "/test-filename-management/case-sensitivity/something-lowercase.md" => "/test-filename-management/case-sensitivity/a (4).md",
				  "/test-filename-management/case-sensitivity/something.md" => "/test-filename-management/case-sensitivity/A (5).md",
				  "/test-filename-management/illegal-characters.md" => "/test-filename-management/I might have some deviant filename characters.md",
				  "/test-filename-management/long-content/a.md" => "/test-filename-management/long-content/Lorem ipsum dolor sit amet, consectetur adipiscing elit,... (1).md",
				  "/test-filename-management/long-content/b.md" => "/test-filename-management/long-content/Lorem ipsum dolor sit amet, consectetur adipiscing elit,... (2).md",
				  "/test-filename-management/multi-line/i-have-many-lines.md" => "/test-filename-management/multi-line/This.md",
				  "/test-filename-management/some-question-too.md" => "/test-filename-management/some-question (1).md",
				  "/test-filename-management/some-question.md" => "/test-filename-management/some-question (2).md",
				  "/test-filename-management/something.md" => "/test-filename-management/some-question (3).md",
				  "/test-filename-management/subfolder/some-question-too.md" => "/test-filename-management/subfolder/some-question (1).md",
				  "/test-filename-management/subfolder/some-question.md" => "/test-filename-management/subfolder/some-question (2).md",
				  "/test-filename-management/subfolder/something.md" => "/test-filename-management/subfolder/some-question (3).md",
				  "/test-filename-management/very-long-title-one-word.md" => "/test-filename-management/this note has a very long title indeed what can be done....md",
				  "/test-filename-management/very-long-title.md" => "/test-filename-management/thisnotehasaverylongonewordtitlecanwestillsplititusingthe....md",
				}
			`)

			// Do it again to check for stability
			const tempPath = path.posix.dirname(context.markdownFiles[0])
			const newFileList = await globby(`${pathExtras.normalize(tempPath)}/**/*.md`, {
				absolute: true,
			})
			const newAllFileList = await globby(`${pathExtras.normalize(tempPath)}/**/*`, {
				absolute: true,
			})

			const resultsRound2 = await syncFiles(newFileList, {
				allFilePaths: newAllFileList,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'prompt',
				namespace: context.namespace,
				syncMediaAssets: 'off',
			})

			const renamedFilesMap = new Map<string, string>()
			for (const syncedFile of resultsRound2.synced) {
				const original = cleanUpTempPath(syncedFile.filePathOriginal)
				const current = cleanUpTempPath(syncedFile.filePath)
				if (original !== current) {
					renamedFilesMap.set(original!, current!)
				}
			}

			expect(renamedFilesMap).toMatchInlineSnapshot(`Map {}`)
		})
	},
)

describeWithFileFixture(
	'more filename management',
	{
		assetPath: './test/assets/test-filename-management/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('uses the response as a filename', async () => {
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'response',
				namespace: context.namespace,
				syncMediaAssets: 'off',
			})

			const changeMap = new Map<string, string>()
			for (const { filePath, filePathOriginal } of results.synced) {
				expect(filePath).toBeDefined()
				expect(filePathOriginal).toBeDefined()
				changeMap.set(cleanUpTempPath(filePathOriginal)!, cleanUpTempPath(filePath)!)
			}

			expect(changeMap).toMatchInlineSnapshot(`
				Map {
				  "/test-filename-management/case-sensitivity/a.md" => "/test-filename-management/case-sensitivity/B (1).md",
				  "/test-filename-management/case-sensitivity/b.md" => "/test-filename-management/case-sensitivity/B (2).md",
				  "/test-filename-management/case-sensitivity/something-else.md" => "/test-filename-management/case-sensitivity/B (3).md",
				  "/test-filename-management/case-sensitivity/something-lowercase.md" => "/test-filename-management/case-sensitivity/b (4).md",
				  "/test-filename-management/case-sensitivity/something.md" => "/test-filename-management/case-sensitivity/B (5).md",
				  "/test-filename-management/illegal-characters.md" => "/test-filename-management/I might have some deviant filename characters.md",
				  "/test-filename-management/long-content/a.md" => "/test-filename-management/long-content/Jowl sausage, spare ribs meatloaf ham fatback pork... (1).md",
				  "/test-filename-management/long-content/b.md" => "/test-filename-management/long-content/Jowl sausage, spare ribs meatloaf ham fatback pork... (2).md",
				  "/test-filename-management/multi-line/i-have-many-lines.md" => "/test-filename-management/multi-line/And this.md",
				  "/test-filename-management/some-question-too.md" => "/test-filename-management/some-answer (1).md",
				  "/test-filename-management/some-question.md" => "/test-filename-management/some-answer (2).md",
				  "/test-filename-management/something.md" => "/test-filename-management/some-answer (3).md",
				  "/test-filename-management/subfolder/some-question-too.md" => "/test-filename-management/subfolder/some-answer (1).md",
				  "/test-filename-management/subfolder/some-question.md" => "/test-filename-management/subfolder/some-answer (2).md",
				  "/test-filename-management/subfolder/something.md" => "/test-filename-management/subfolder/some-answer (3).md",
				  "/test-filename-management/very-long-title-one-word.md" => "/test-filename-management/this note has a very long title indeed what can be done....md",
				  "/test-filename-management/very-long-title.md" => "/test-filename-management/thisnotehasaverylongonewordtitlecanwestillsplititusingthe....md",
				}
			`)

			// Do it again to check for stability
			const tempPath = path.posix.dirname(context.markdownFiles[0])
			const newFileList = await globby(`${pathExtras.normalize(tempPath)}/**/*.md`, {
				absolute: true,
			})
			const newAllFileList = await globby(`${pathExtras.normalize(tempPath)}/**/*`, {
				absolute: true,
			})

			const resultsRound2 = await syncFiles(newFileList, {
				allFilePaths: newAllFileList,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'response',
				namespace: context.namespace,
				syncMediaAssets: 'off',
			})

			const renamedFilesMap = new Map<string, string>()
			for (const syncedFile of resultsRound2.synced) {
				const original = cleanUpTempPath(syncedFile.filePathOriginal)
				const current = cleanUpTempPath(syncedFile.filePath)
				if (original !== current) {
					renamedFilesMap.set(original!, current!)
				}
			}

			expect(renamedFilesMap).toMatchInlineSnapshot(`Map {}`)
		})
	},
)

describeWithFileFixture(
	'even more filename management',
	{
		assetPath: './test/assets/test-filename-management/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('does not touch the filename unless asked', async () => {
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'off',
				namespace: context.namespace,
			})

			const changeMap = new Map<string, string>()
			for (const { filePath, filePathOriginal } of results.synced) {
				expect(filePath).toBeDefined()
				expect(filePathOriginal).toBeDefined()
				changeMap.set(cleanUpTempPath(filePathOriginal)!, cleanUpTempPath(filePath)!)
			}

			expect(changeMap).toMatchInlineSnapshot(`
				Map {
				  "/test-filename-management/case-sensitivity/a.md" => "/test-filename-management/case-sensitivity/a.md",
				  "/test-filename-management/case-sensitivity/b.md" => "/test-filename-management/case-sensitivity/b.md",
				  "/test-filename-management/case-sensitivity/something-else.md" => "/test-filename-management/case-sensitivity/something-else.md",
				  "/test-filename-management/case-sensitivity/something-lowercase.md" => "/test-filename-management/case-sensitivity/something-lowercase.md",
				  "/test-filename-management/case-sensitivity/something.md" => "/test-filename-management/case-sensitivity/something.md",
				  "/test-filename-management/illegal-characters.md" => "/test-filename-management/illegal-characters.md",
				  "/test-filename-management/long-content/a.md" => "/test-filename-management/long-content/a.md",
				  "/test-filename-management/long-content/b.md" => "/test-filename-management/long-content/b.md",
				  "/test-filename-management/multi-line/i-have-many-lines.md" => "/test-filename-management/multi-line/i-have-many-lines.md",
				  "/test-filename-management/some-question-too.md" => "/test-filename-management/some-question-too.md",
				  "/test-filename-management/some-question.md" => "/test-filename-management/some-question.md",
				  "/test-filename-management/something.md" => "/test-filename-management/something.md",
				  "/test-filename-management/subfolder/some-question-too.md" => "/test-filename-management/subfolder/some-question-too.md",
				  "/test-filename-management/subfolder/some-question.md" => "/test-filename-management/subfolder/some-question.md",
				  "/test-filename-management/subfolder/something.md" => "/test-filename-management/subfolder/something.md",
				  "/test-filename-management/very-long-title-one-word.md" => "/test-filename-management/very-long-title-one-word.md",
				  "/test-filename-management/very-long-title.md" => "/test-filename-management/very-long-title.md",
				}
			`)
		})
	},
)

describeWithFileFixture(
	'complex note type filename management',
	{
		assetPath: './test/assets/test-minimal-notes/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('uses the prompt as a filename across many note types', async () => {
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'prompt',
				namespace: context.namespace,
				syncMediaAssets: 'off',
			})

			const changeMap = new Map<string, string>()
			for (const { filePath, filePathOriginal } of results.synced) {
				expect(filePath).toBeDefined()
				expect(filePathOriginal).toBeDefined()
				changeMap.set(cleanUpTempPath(filePathOriginal)!, cleanUpTempPath(filePath)!)
			}

			expect(changeMap).toMatchInlineSnapshot(`
				Map {
				  "/test-minimal-notes/cloze-with-nothing-else.md" => "/test-minimal-notes/a lonely cloze.md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-back-and-no-front.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (1).md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-front-and-no-back.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (2).md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-single-line-with-empty-frontmatter.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (3).md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-single-line-with-frontmatter.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (4).md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-single-line.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (5).md",
				  "/test-minimal-notes/basic-and-reversed-card-with-no-back.md" => "/test-minimal-notes/I'm a question to which there is no answer.md",
				  "/test-minimal-notes/basic-and-reversed-card-with-no-front.md" => "/test-minimal-notes/I'm an answer to which there is no question.md",
				  "/test-minimal-notes/basic-and-reversed-card-with-extra.md" => "/test-minimal-notes/I'm question which is sometimes the answer (1).md",
				  "/test-minimal-notes/basic-and-reversed-card.md" => "/test-minimal-notes/I'm question which is sometimes the answer (2).md",
				  "/test-minimal-notes/basic-with-back-and-no-front-with-empty-frontmatter.md" => "/test-minimal-notes/I'm the back of the card (1).md",
				  "/test-minimal-notes/basic-with-back-and-no-front.md" => "/test-minimal-notes/I'm the back of the card (2).md",
				  "/test-minimal-notes/basic-with-front-and-no-back.md" => "/test-minimal-notes/I'm the front of the card (1).md",
				  "/test-minimal-notes/basic.md" => "/test-minimal-notes/I'm the front of the card (2).md",
				  "/test-minimal-notes/basic-type-in-the-answer-with-empty-frontmatter.md" => "/test-minimal-notes/I'm the prompt (1).md",
				  "/test-minimal-notes/basic-type-in-the-answer-with-frontmatter.md" => "/test-minimal-notes/I'm the prompt (2).md",
				  "/test-minimal-notes/basic-type-in-the-answer-with-multiple-emphasis-and-ignored-answer-style.md" => "/test-minimal-notes/I'm the prompt (3).md",
				  "/test-minimal-notes/basic-type-in-the-answer-with-multiple-emphasis.md" => "/test-minimal-notes/I'm the prompt (4).md",
				  "/test-minimal-notes/basic-type-in-the-answer.md" => "/test-minimal-notes/I'm the prompt (5).md",
				  "/test-minimal-notes/basic-with-front-and-cloze-like-back.md" => "/test-minimal-notes/I'm the question.md",
				  "/test-minimal-notes/cloze-with-no-preamble.md" => "/test-minimal-notes/is the.md",
				  "/test-minimal-notes/basic-with-empty-frontmatter.md" => "/test-minimal-notes/My frontmatter is empty.md",
				  "/test-minimal-notes/cloze-with-extra-empty.md" => "/test-minimal-notes/This card has a (1).md",
				  "/test-minimal-notes/cloze-with-extra.md" => "/test-minimal-notes/This card has a (2).md",
				  "/test-minimal-notes/cloze-with-style.md" => "/test-minimal-notes/This card has a (3).md",
				  "/test-minimal-notes/cloze.md" => "/test-minimal-notes/This card has a (4).md",
				  "/test-minimal-notes/basic-with-cloze-like-back-and-no-front.md" => "/test-minimal-notes/This looks a lot like a cloze but it's a basic answer.md",
				  "/test-minimal-notes/basic-with-empty-everything.md" => "/test-minimal-notes/Untitled (1).md",
				  "/test-minimal-notes/basic-with-front-image-markdown-embed-and-no-back.md" => "/test-minimal-notes/Untitled (2).md",
				  "/test-minimal-notes/basic-with-front-image-wiki-embed-and-no-back.md" => "/test-minimal-notes/Untitled (3).md",
				}
			`)

			// Do it again to check for stability
			const tempPath = path.posix.dirname(context.markdownFiles[0])
			const newFileList = await globby(`${pathExtras.normalize(tempPath)}/**/*.md`, {
				absolute: true,
			})
			const newAllFileList = await globby(`${pathExtras.normalize(tempPath)}/**/*`, {
				absolute: true,
			})

			const resultsRound2 = await syncFiles(newFileList, {
				allFilePaths: newAllFileList,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'prompt',
				namespace: context.namespace,
				syncMediaAssets: 'off',
			})

			const renamedFilesMap = new Map<string, string>()
			for (const syncedFile of resultsRound2.synced) {
				const original = cleanUpTempPath(syncedFile.filePathOriginal)
				const current = cleanUpTempPath(syncedFile.filePath)
				if (original !== current) {
					renamedFilesMap.set(original!, current!)
				}
			}

			expect(renamedFilesMap).toMatchInlineSnapshot(`Map {}`)
		})
	},
)

describeWithFileFixture(
	'more complex note type filename management',
	{
		assetPath: './test/assets/test-minimal-notes/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('uses the response as a filename across many note types', async () => {
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'response',
				namespace: context.namespace,
				syncMediaAssets: 'off',
			})

			const changeMap = new Map<string, string>()
			for (const { filePath, filePathOriginal } of results.synced) {
				expect(filePath).toBeDefined()
				expect(filePathOriginal).toBeDefined()
				changeMap.set(cleanUpTempPath(filePathOriginal)!, cleanUpTempPath(filePath)!)
			}

			expect(changeMap).toMatchInlineSnapshot(`
				Map {
				  "/test-minimal-notes/cloze-with-nothing-else.md" => "/test-minimal-notes/a lonely cloze.md",
				  "/test-minimal-notes/cloze-with-extra-empty.md" => "/test-minimal-notes/cloze (1).md",
				  "/test-minimal-notes/cloze-with-extra.md" => "/test-minimal-notes/cloze (2).md",
				  "/test-minimal-notes/cloze-with-no-preamble.md" => "/test-minimal-notes/cloze (3).md",
				  "/test-minimal-notes/cloze.md" => "/test-minimal-notes/cloze (4).md",
				  "/test-minimal-notes/cloze-with-style.md" => "/test-minimal-notes/emphasized but un-hinted cloze.md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-back-and-no-front.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (1).md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-front-and-no-back.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (2).md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-single-line-with-empty-frontmatter.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (3).md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-single-line-with-frontmatter.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (4).md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-single-line.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (5).md",
				  "/test-minimal-notes/basic-and-reversed-card-with-no-back.md" => "/test-minimal-notes/I'm a question to which there is no answer.md",
				  "/test-minimal-notes/basic-and-reversed-card-with-no-front.md" => "/test-minimal-notes/I'm an answer to which there is no question.md",
				  "/test-minimal-notes/basic-and-reversed-card-with-extra.md" => "/test-minimal-notes/I'm an answer which is sometimes the question (1).md",
				  "/test-minimal-notes/basic-and-reversed-card.md" => "/test-minimal-notes/I'm an answer which is sometimes the question (2).md",
				  "/test-minimal-notes/basic-with-back-and-no-front-with-empty-frontmatter.md" => "/test-minimal-notes/I'm the back of the card (1).md",
				  "/test-minimal-notes/basic-with-back-and-no-front.md" => "/test-minimal-notes/I'm the back of the card (2).md",
				  "/test-minimal-notes/basic.md" => "/test-minimal-notes/I'm the back of the card (3).md",
				  "/test-minimal-notes/basic-with-front-and-no-back.md" => "/test-minimal-notes/I'm the front of the card.md",
				  "/test-minimal-notes/basic-type-in-the-answer-with-empty-frontmatter.md" => "/test-minimal-notes/I'm the thing you need to type on the card (1).md",
				  "/test-minimal-notes/basic-type-in-the-answer-with-frontmatter.md" => "/test-minimal-notes/I'm the thing you need to type on the card (2).md",
				  "/test-minimal-notes/basic-type-in-the-answer-with-multiple-emphasis-and-ignored-answer-style.md" => "/test-minimal-notes/I'm the thing you need to type on the card (3).md",
				  "/test-minimal-notes/basic-type-in-the-answer-with-multiple-emphasis.md" => "/test-minimal-notes/I'm the thing you need to type on the card (4).md",
				  "/test-minimal-notes/basic-type-in-the-answer.md" => "/test-minimal-notes/I'm the thing you need to type on the card (5).md",
				  "/test-minimal-notes/basic-with-empty-frontmatter.md" => "/test-minimal-notes/My frontmatter is empty.md",
				  "/test-minimal-notes/basic-with-cloze-like-back-and-no-front.md" => "/test-minimal-notes/This looks a lot like a cloze but it's a basic answer.md",
				  "/test-minimal-notes/basic-with-front-and-cloze-like-back.md" => "/test-minimal-notes/This looks a lot like a cloze or two here's a hint.md",
				  "/test-minimal-notes/basic-with-empty-everything.md" => "/test-minimal-notes/Untitled (1).md",
				  "/test-minimal-notes/basic-with-front-image-markdown-embed-and-no-back.md" => "/test-minimal-notes/Untitled (2).md",
				  "/test-minimal-notes/basic-with-front-image-wiki-embed-and-no-back.md" => "/test-minimal-notes/Untitled (3).md",
				}
			`)

			// Do it again to check for stability
			const tempPath = path.posix.dirname(context.markdownFiles[0])
			const newFileList = await globby(`${pathExtras.normalize(tempPath)}/**/*.md`, {
				absolute: true,
			})
			const newAllFileList = await globby(`${pathExtras.normalize(tempPath)}/**/*`, {
				absolute: true,
			})

			const resultsRound2 = await syncFiles(newFileList, {
				allFilePaths: newAllFileList,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'response',
				namespace: context.namespace,
				syncMediaAssets: 'off',
			})

			const renamedFilesMap = new Map<string, string>()
			for (const syncedFile of resultsRound2.synced) {
				const original = cleanUpTempPath(syncedFile.filePathOriginal)
				const current = cleanUpTempPath(syncedFile.filePath)
				if (original !== current) {
					renamedFilesMap.set(original!, current!)
				}
			}

			expect(renamedFilesMap).toMatchInlineSnapshot(`Map {}`)
		})
	},
)

describeWithFileFixture(
	'filename collision management',
	{
		assetPath: './test/assets/test-filename-management-collision/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('handles filename management deck collisions', async () => {
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'prompt',
				namespace: context.namespace,
				syncMediaAssets: 'off',
			})

			expect(stableResults(results)).toMatchSnapshot()
		})
	},
)

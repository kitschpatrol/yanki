import { syncFiles } from '../src/lib'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { cleanUpTempPath } from './utilities/stable-sync-results'
import { expect, it } from 'vitest'

describeWithFileFixture(
	'filename management',
	{
		assetPath: './test/assets/test-filename-management/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('uses the prompt as a filename', async () => {
			const results = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'prompt',
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
				  "/test-filename-management/illegal-characters.md" => "/test-filename-management/I might have some deviant filename characters.md",
				  "/test-filename-management/some-question-too.md" => "/test-filename-management/some-question.md",
				  "/test-filename-management/some-question.md" => "/test-filename-management/some-question (1).md",
				  "/test-filename-management/something.md" => "/test-filename-management/some-question (2).md",
				  "/test-filename-management/very-long-title-one-word.md" => "/test-filename-management/this note has a very long title indeed what can be done....md",
				  "/test-filename-management/very-long-title.md" => "/test-filename-management/thisnotehasaverylongonewordtitlecanwestillsplititusingthetru....md",
				  "/test-filename-management/subfolder/some-question-too.md" => "/test-filename-management/subfolder/some-question.md",
				  "/test-filename-management/subfolder/some-question.md" => "/test-filename-management/subfolder/some-question (1).md",
				  "/test-filename-management/subfolder/something.md" => "/test-filename-management/subfolder/some-question (2).md",
				}
			`)
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
			const results = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'response',
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
				  "/test-filename-management/illegal-characters.md" => "/test-filename-management/I might have some deviant filename characters.md",
				  "/test-filename-management/some-question-too.md" => "/test-filename-management/some-answer.md",
				  "/test-filename-management/some-question.md" => "/test-filename-management/some-answer (1).md",
				  "/test-filename-management/something.md" => "/test-filename-management/some-answer (2).md",
				  "/test-filename-management/very-long-title-one-word.md" => "/test-filename-management/this note has a very long title indeed what can be done....md",
				  "/test-filename-management/very-long-title.md" => "/test-filename-management/thisnotehasaverylongonewordtitlecanwestillsplititusingthetru....md",
				  "/test-filename-management/subfolder/some-question-too.md" => "/test-filename-management/subfolder/some-answer.md",
				  "/test-filename-management/subfolder/some-question.md" => "/test-filename-management/subfolder/some-answer (1).md",
				  "/test-filename-management/subfolder/something.md" => "/test-filename-management/subfolder/some-answer (2).md",
				}
			`)
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
			const results = await syncFiles(context.files, {
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
				  "/test-filename-management/illegal-characters.md" => "/test-filename-management/illegal-characters.md",
				  "/test-filename-management/some-question-too.md" => "/test-filename-management/some-question-too.md",
				  "/test-filename-management/some-question.md" => "/test-filename-management/some-question.md",
				  "/test-filename-management/something.md" => "/test-filename-management/something.md",
				  "/test-filename-management/very-long-title-one-word.md" => "/test-filename-management/very-long-title-one-word.md",
				  "/test-filename-management/very-long-title.md" => "/test-filename-management/very-long-title.md",
				  "/test-filename-management/subfolder/some-question-too.md" => "/test-filename-management/subfolder/some-question-too.md",
				  "/test-filename-management/subfolder/some-question.md" => "/test-filename-management/subfolder/some-question.md",
				  "/test-filename-management/subfolder/something.md" => "/test-filename-management/subfolder/something.md",
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
			const results = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'prompt',
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
				  "/test-minimal-notes/basic-and-reversed-card-with-no-back.md" => "/test-minimal-notes/I'm a question to which there is no answer.md",
				  "/test-minimal-notes/basic-and-reversed-card-with-no-front.md" => "/test-minimal-notes/I'm an answer to which there is no question.md",
				  "/test-minimal-notes/basic-and-reversed-card.md" => "/test-minimal-notes/I'm question which is sometimes the answer.md",
				  "/test-minimal-notes/basic-type-in-the-answer-with-empty-frontmatter.md" => "/test-minimal-notes/I'm the prompt.md",
				  "/test-minimal-notes/basic-type-in-the-answer-with-frontmatter.md" => "/test-minimal-notes/I'm the prompt (1).md",
				  "/test-minimal-notes/basic-type-in-the-answer-with-multiple-emphasis-and-ignored-answer-style.md" => "/test-minimal-notes/I'm the prompt I'm actually also part of the prompt!.md",
				  "/test-minimal-notes/basic-type-in-the-answer-with-multiple-emphasis.md" => "/test-minimal-notes/I'm the prompt I'm actually also part of the prompt! (1).md",
				  "/test-minimal-notes/basic-type-in-the-answer.md" => "/test-minimal-notes/I'm the prompt (2).md",
				  "/test-minimal-notes/basic-with-back-and-no-front-with-empty-frontmatter.md" => "/test-minimal-notes/I'm the back of the card I have no front.md",
				  "/test-minimal-notes/basic-with-back-and-no-front.md" => "/test-minimal-notes/I'm the back of the card I have no front (1).md",
				  "/test-minimal-notes/basic-with-cloze-like-back-and-no-front.md" => "/test-minimal-notes/This looks a lot like a cloze but it's a basic answer.md",
				  "/test-minimal-notes/basic-with-empty-everything.md" => "/test-minimal-notes/Untitled.md",
				  "/test-minimal-notes/basic-with-empty-frontmatter.md" => "/test-minimal-notes/My frontmatter is empty.md",
				  "/test-minimal-notes/basic-with-front-and-cloze-like-back.md" => "/test-minimal-notes/I'm the question.md",
				  "/test-minimal-notes/basic-with-front-and-no-back.md" => "/test-minimal-notes/I'm the front of the card I have no back.md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-back-and-no-front.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm....md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-front-and-no-back.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (1).md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-single-line-with-empty-frontmatter.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (2).md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-single-line-with-frontmatter.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (3).md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-single-line.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (4).md",
				  "/test-minimal-notes/basic.md" => "/test-minimal-notes/I'm the front of the card.md",
				  "/test-minimal-notes/cloze-with-extra-empty.md" => "/test-minimal-notes/This card has a.md",
				  "/test-minimal-notes/cloze-with-extra.md" => "/test-minimal-notes/This card has a (1).md",
				  "/test-minimal-notes/cloze-with-no-preamble.md" => "/test-minimal-notes/is the.md",
				  "/test-minimal-notes/cloze-with-nothing-else.md" => "/test-minimal-notes/Untitled (1).md",
				  "/test-minimal-notes/cloze-with-style.md" => "/test-minimal-notes/This card has a (2).md",
				  "/test-minimal-notes/cloze.md" => "/test-minimal-notes/This card has a (3).md",
				}
			`)
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
			const results = await syncFiles(context.files, {
				ankiWeb: false,
				dryRun: false,
				manageFilenames: 'response',
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
				  "/test-minimal-notes/basic-and-reversed-card-with-no-back.md" => "/test-minimal-notes/I'm a question to which there is no answer.md",
				  "/test-minimal-notes/basic-and-reversed-card-with-no-front.md" => "/test-minimal-notes/I'm an answer to which there is no question.md",
				  "/test-minimal-notes/basic-and-reversed-card.md" => "/test-minimal-notes/I'm an answer which is sometimes the question.md",
				  "/test-minimal-notes/basic-type-in-the-answer-with-empty-frontmatter.md" => "/test-minimal-notes/I'm the thing you need to type on the card.md",
				  "/test-minimal-notes/basic-type-in-the-answer-with-frontmatter.md" => "/test-minimal-notes/I'm the thing you need to type on the card (1).md",
				  "/test-minimal-notes/basic-type-in-the-answer-with-multiple-emphasis-and-ignored-answer-style.md" => "/test-minimal-notes/I'm the thing you need to type on the card (2).md",
				  "/test-minimal-notes/basic-type-in-the-answer-with-multiple-emphasis.md" => "/test-minimal-notes/I'm the thing you need to type on the card (3).md",
				  "/test-minimal-notes/basic-type-in-the-answer.md" => "/test-minimal-notes/I'm the thing you need to type on the card (4).md",
				  "/test-minimal-notes/basic-with-back-and-no-front-with-empty-frontmatter.md" => "/test-minimal-notes/I'm the back of the card I have no front.md",
				  "/test-minimal-notes/basic-with-back-and-no-front.md" => "/test-minimal-notes/I'm the back of the card I have no front (1).md",
				  "/test-minimal-notes/basic-with-cloze-like-back-and-no-front.md" => "/test-minimal-notes/This looks a lot like a cloze but it's a basic answer.md",
				  "/test-minimal-notes/basic-with-empty-everything.md" => "/test-minimal-notes/Untitled.md",
				  "/test-minimal-notes/basic-with-empty-frontmatter.md" => "/test-minimal-notes/My frontmatter is empty.md",
				  "/test-minimal-notes/basic-with-front-and-cloze-like-back.md" => "/test-minimal-notes/This looks a lot like a cloze or two here's a hint.md",
				  "/test-minimal-notes/basic-with-front-and-no-back.md" => "/test-minimal-notes/I'm the front of the card I have no back.md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-back-and-no-front.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm....md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-front-and-no-back.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (1).md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-single-line-with-empty-frontmatter.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (2).md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-single-line-with-frontmatter.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (3).md",
				  "/test-minimal-notes/basic-with-type-in-the-answer-like-single-line.md" => "/test-minimal-notes/I look a lot like the thing you need to type in, but i'm... (4).md",
				  "/test-minimal-notes/basic.md" => "/test-minimal-notes/I'm the back of the card.md",
				  "/test-minimal-notes/cloze-with-extra-empty.md" => "/test-minimal-notes/This card has a.md",
				  "/test-minimal-notes/cloze-with-extra.md" => "/test-minimal-notes/This card has a (1).md",
				  "/test-minimal-notes/cloze-with-no-preamble.md" => "/test-minimal-notes/is the.md",
				  "/test-minimal-notes/cloze-with-nothing-else.md" => "/test-minimal-notes/Untitled (1).md",
				  "/test-minimal-notes/cloze-with-style.md" => "/test-minimal-notes/This card has a (2).md",
				  "/test-minimal-notes/cloze.md" => "/test-minimal-notes/This card has a (3).md",
				}
			`)
		})
	},
)

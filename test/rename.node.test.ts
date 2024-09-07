import path from 'node:path'
import { expect, it } from 'vitest'
import { renameFiles } from '../src/lib'
import { describeWithFileFixture } from './fixtures/file-fixture'

describeWithFileFixture(
	'list notes',
	{
		assetPath: './test/assets/test-minimal-notes/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('should rename files', async () => {
			const result = await renameFiles(context.markdownFiles, {
				manageFilenames: 'response',
			})

			const fileNames = result.notes.map((r) => path.posix.basename(r.filePath))

			expect(fileNames).toMatchInlineSnapshot(`
				[
				  "I look a lot like the thing you need to type in, but i'm... (1).md",
				  "I look a lot like the thing you need to type in, but i'm... (2).md",
				  "I look a lot like the thing you need to type in, but i'm... (3).md",
				  "I look a lot like the thing you need to type in, but i'm... (4).md",
				  "I look a lot like the thing you need to type in, but i'm... (5).md",
				  "I'm a question to which there is no answer.md",
				  "I'm an answer to which there is no question.md",
				  "I'm an answer which is sometimes the question (1).md",
				  "I'm an answer which is sometimes the question (2).md",
				  "I'm the back of the card (1).md",
				  "I'm the back of the card (2).md",
				  "I'm the back of the card (3).md",
				  "I'm the front of the card.md",
				  "I'm the thing you need to type on the card (1).md",
				  "I'm the thing you need to type on the card (2).md",
				  "I'm the thing you need to type on the card (3).md",
				  "I'm the thing you need to type on the card (4).md",
				  "I'm the thing you need to type on the card (5).md",
				  "is the.md",
				  "My frontmatter is empty.md",
				  "This card has a (1).md",
				  "This card has a (2).md",
				  "This card has a (3).md",
				  "This card has a (4).md",
				  "This looks a lot like a cloze but it's a basic answer.md",
				  "This looks a lot like a cloze or two here's a hint.md",
				  "Untitled (1).md",
				  "Untitled (2).md",
				  "Untitled (3).md",
				  "Untitled (4).md",
				]
			`)
		})
	},
)

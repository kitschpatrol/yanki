import { cleanNotes, syncFiles } from './src/lib'
// Import { mdastToHtml } from './src/lib/parse/rehype-utilities'
// import { getAstFromMarkdown } from './src/lib/parse/remark-utilities'
// import fs from 'node:fs/promises'

const paths = [
	'test/assets/minimal-notes/basic-and-reversed-card-with-no-back.md',
	'test/assets/minimal-notes/basic-and-reversed-card-with-no-front.md',
	'test/assets/minimal-notes/basic-and-reversed-card.md',
	'test/assets/minimal-notes/basic-type-in-the-answer-with-empty-frontmatter.md',
	'test/assets/minimal-notes/basic-type-in-the-answer-with-frontmatter.md',
	'test/assets/minimal-notes/basic-type-in-the-answer-with-multiple-emphasis.md',
	'test/assets/minimal-notes/basic-type-in-the-answer.md',
	'test/assets/minimal-notes/basic-with-cloze-like-back.md',
	'test/assets/minimal-notes/basic-with-empty-everything.md',
	'test/assets/minimal-notes/basic-with-empty-frontmatter.md',
	'test/assets/minimal-notes/basic-with-no-back.md',
	'test/assets/minimal-notes/basic-with-no-front-empty-frontmatter.md',
	'test/assets/minimal-notes/basic-with-no-front.md',
	'test/assets/minimal-notes/basic-with-type-in-like-answer-and-no-back.md',
	'test/assets/minimal-notes/basic-with-type-in-like-answer-and-no-front.md',
	'test/assets/minimal-notes/basic-with-type-in-like-single-line-with-empty-frontmatter.md',
	'test/assets/minimal-notes/basic-with-type-in-like-single-line-with-frontmatter.md',
	'test/assets/minimal-notes/basic-with-type-in-like-single-line.md',
	'test/assets/minimal-notes/basic.md',
	'test/assets/minimal-notes/cloze-with-extra-empty.md',
	'test/assets/minimal-notes/cloze-with-extra.md',
	'test/assets/minimal-notes/cloze-with-style.md',
	'test/assets/minimal-notes/cloze.md',
]

const cleanResults = await cleanNotes({
	dryRun: false,
	namespace: '*',
})

console.log('Cleaned ----------------------------------')
console.log(cleanResults.deleted.length)

const results = await syncFiles(paths, {
	namespace: 'YankiTestFile',
})

console.log('----------------------------------')
console.log('----------------------------------')
console.log(JSON.stringify(results, undefined, 2))

//
// const markdown = await fs.readFile(
// 	'./test/assets/minimal-notes/basic-with-empty-everything.md',
// 	'utf8',
// )

// Console.log('----------------------------------')
// console.log(markdown)

// const mdast = await getAstFromMarkdown(markdown, {
// 	obsidianVault: 'Vault',
// })

// console.log('----------------------------------')
// console.log(JSON.stringify(mdast, undefined, 2))

// console.log('----------------------------------')
// const html = await mdastToHtml(mdast)

// console.log(html)

// "<p>I'm an <strong>answer</strong> to which there is no question.</p>"
// "<p>I'm an <strong>answer</strong> to which there is no question.</p>",

// "<!-- This is tricky, if the very first two lines are `---` and `---` then assume it's empty frontmatter. But if there's a space first, as will be generated from this comment, then assume it's an empty \"front\" of a basic (and reversed card) note. -->"
// "<!-- This is tricky, if the very first two lines are `---` and `---` then assume it's empty frontmatter. But if there's a space first, as will be generated from this comment, then assume it's an empty \"front\" of a basic (and reversed card) note. -->"

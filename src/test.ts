import * as pathExtras from './lib/utilities/path'
import { resolveLink } from './lib/utilities/resolve-link'
import path from 'path-browserify-esm'

// // Console.log(pathExtras.normalize(String.raw`C:\something\something\/**/*.md`))
// // console.log(pathExtras.normalize(String.raw`C:/something/something//**/*.md`))
// // console.log(pathExtras.normalize(String.raw`C:\\something\\something\\/**/*.md`))
// // console.log(
// // 	pathExtras.normalize(
// // 		String.raw`/base-path/cwd/.\test\assets\test-obsidian-vault\test card?foo=bar baz`,
// // 	),
// // )
// // console.log(
// // 	pathExtras.normalize(
// // 		String.raw`/base-path/cwd/..\cwd\test\assets\test-obsidian-vault\test card.md#bla#bla`,
// // 	),
// // )

// console.log('----------------------------------')

// console.log(
// 	pathExtras.resolveWithBasePath('/foo/bar/baz.md', {
// 		basePath: 'C:/yes/foo/',
// 		cwd: 'C:/yes/foo/oh/really/',
// 	}),
// )

// console.log(
// 	pathExtras.resolveWithBasePath('./foo/bar/biz.md', {
// 		basePath: 'C:/yes/foo/',
// 		cwd: 'C:/yes/foo/oh/really/',
// 	}),
// )

// console.log(
// 	pathExtras.resolveWithBasePath('C:/yes/foo/oh/really/foo/bar/boz.md', {
// 		basePath: 'C:/yes/foo/',
// 		cwd: 'C:/yes/foo/oh/really/',
// 	}),
// )

const allFilePaths = [
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/test card.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/test image.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/yanki image.jpg',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Assets/test image.jpeg',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Assets/test image.jpg',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Assets/test image.png',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Assets/test pdf.pdf',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Assets/yanki audio.mp3',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Assets/yanki video.mp4',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Wiki Links/test card.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Wiki Links/test image.jpg',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Wiki Links/test image.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Wiki Links/Nested/test card.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Wiki Links/Nested/test image.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Group 1/test card.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Group 1/test image.jpg',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Group 1/test image.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Group 1/test image.png',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/audio.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/blocks.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/callouts.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/code.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/comments.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/diagrams.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/embedding.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/footnotes.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/headings.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/html.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/images.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/links.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/lists.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/math.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/quotes.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/rules.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/style.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/tables.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Markdown/video.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Group 2/another test card.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Group 2/test card.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Group 2/test image.jpg',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Group 2/test image.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Group 2/test image.png',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Wiki Links/Nested/Nested/test card.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Wiki Links/Nested/Nested/test image.jpg',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Group 1/Sub Group/another test card.md',
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Cards/Group 1/Sub Group/test card.md',
]

const cwd = path.dirname(
	'/Users/mika/Code/yanki/test/assets/test-obsidian-vault/Wiki Links/test card.md',
)

// Console.log('----------------------------------')

// const resolved = resolveLink('./test card.md', {
// 	allFilePaths,
// 	basePath: '/Users/mika/Code/yanki/test/assets/test-obsidian-vault',
// 	cwd,
// 	type: 'link',
// })

// console.log(resolved)

console.log('----------------------------------')

const resolved2 = resolveLink('bla test card', {
	// AllFilePaths: [],
	// basePath: '/Users/mika/Code/yanki/test/assets/test-obsidian-vault',
	cwd,
	type: 'link',
})

console.log(resolved2)

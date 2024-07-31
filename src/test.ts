import * as pathExtras from './lib/utilities/path'

// Console.log(pathExtras.normalize(String.raw`C:\something\something\/**/*.md`))
// console.log(pathExtras.normalize(String.raw`C:/something/something//**/*.md`))
// console.log(pathExtras.normalize(String.raw`C:\\something\\something\\/**/*.md`))
console.log(
	pathExtras.normalize(
		String.raw`/base-path/cwd/.\test\assets\test-obsidian-vault\test card?foo=bar baz`,
	),
)
console.log(
	pathExtras.normalize(
		String.raw`/base-path/cwd/..\cwd\test\assets\test-obsidian-vault\test card.md#bla#bla`,
	),
)

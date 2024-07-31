import { isAbsolute, isRelative, normalize } from '../src/lib/utilities/path'
import { expect, it } from 'vitest'

const testPathsRaw = [
	String.raw`C:/Bla bla bla`,
	String.raw`/Bla bla bla`,
	String.raw`../Bla bla bla`,
	String.raw`./Bla bla bla`,
	String.raw`.\Bla bla bla`,
	String.raw`.\\Bla bla bla`,
	String.raw`Bla bla bla`,
	String.raw`C:\something\something\/**/*.md`,
	String.raw`C:\something\something\/**/*.md`,
	String.raw`C:\something\something\/**/*.md`,
	String.raw`C:/something/something//**/*.md`,
	String.raw`C:\\something\\something\\/**/*.md`,
	String.raw`../yes`,
	String.raw`C:\Bla bla bla`,
	String.raw`C:\\Bla bla bla`,
	String.raw`C:\\Bla bla bla\\some file.txt`,
	String.raw`d:\Bla bla bla`,
	String.raw`z:\Bla bla bla`,
	String.raw`C:\Bla bla bla`,
	String.raw`C:\\Bla bla bla`,
	String.raw`C:\\Bla bla bla\\some file.txt`,
	String.raw`d:\Bla bla bla`,
	String.raw`z:\Bla bla bla`,
	String.raw`\\?\Volume{abc123-abc123-abc123}\\`,
	String.raw`\\Server\Share\folder`,
]

const testPathsNormalized = testPathsRaw.map((path) => normalize(path))

it('detects absolute paths', () => {
	const results = testPathsNormalized.map(
		(path) => `${path} --> ${isAbsolute(path) ? 'absolute' : 'relative'}`,
	)
	expect(results).toMatchInlineSnapshot(`
		[
		  "C:/Bla bla bla --> relative",
		  "/Bla bla bla --> absolute",
		  "../Bla bla bla --> relative",
		  "./Bla bla bla --> relative",
		  "./Bla bla bla --> relative",
		  "./Bla bla bla --> relative",
		  "Bla bla bla --> relative",
		  "C:/something/something/**/*.md --> relative",
		  "C:/something/something/**/*.md --> relative",
		  "C:/something/something/**/*.md --> relative",
		  "C:/something/something/**/*.md --> relative",
		  "C:/something/something/**/*.md --> relative",
		  "../yes --> relative",
		  "C:/Bla bla bla --> relative",
		  "C:/Bla bla bla --> relative",
		  "C:/Bla bla bla/some file.txt --> relative",
		  "d:/Bla bla bla --> relative",
		  "z:/Bla bla bla --> relative",
		  "C:/Bla bla bla --> relative",
		  "C:/Bla bla bla --> relative",
		  "C:/Bla bla bla/some file.txt --> relative",
		  "d:/Bla bla bla --> relative",
		  "z:/Bla bla bla --> relative",
		  "\\\\?\\Volume{abc123-abc123-abc123}\\\\ --> relative",
		  "/Server/Share/folder --> absolute",
		]
	`)
})

it('detects relative paths', () => {
	const results = testPathsNormalized.map(
		(path) => `${path} --> ${isRelative(path) ? 'relative' : 'absolute'}`,
	)
	expect(results).toMatchInlineSnapshot(`
		[
		  "C:/Bla bla bla --> relative",
		  "/Bla bla bla --> absolute",
		  "../Bla bla bla --> relative",
		  "./Bla bla bla --> relative",
		  "./Bla bla bla --> relative",
		  "./Bla bla bla --> relative",
		  "Bla bla bla --> relative",
		  "C:/something/something/**/*.md --> relative",
		  "C:/something/something/**/*.md --> relative",
		  "C:/something/something/**/*.md --> relative",
		  "C:/something/something/**/*.md --> relative",
		  "C:/something/something/**/*.md --> relative",
		  "../yes --> relative",
		  "C:/Bla bla bla --> relative",
		  "C:/Bla bla bla --> relative",
		  "C:/Bla bla bla/some file.txt --> relative",
		  "d:/Bla bla bla --> relative",
		  "z:/Bla bla bla --> relative",
		  "C:/Bla bla bla --> relative",
		  "C:/Bla bla bla --> relative",
		  "C:/Bla bla bla/some file.txt --> relative",
		  "d:/Bla bla bla --> relative",
		  "z:/Bla bla bla --> relative",
		  "\\\\?\\Volume{abc123-abc123-abc123}\\\\ --> relative",
		  "/Server/Share/folder --> absolute",
		]
	`)
})

it('normalizes paths', () => {
	const results = testPathsRaw.map((path) => `${path} --> ${normalize(path)}`)
	expect(results).toMatchInlineSnapshot(`
		[
		  "C:/Bla bla bla --> C:/Bla bla bla",
		  "/Bla bla bla --> /Bla bla bla",
		  "../Bla bla bla --> ../Bla bla bla",
		  "./Bla bla bla --> ./Bla bla bla",
		  ".\\Bla bla bla --> ./Bla bla bla",
		  ".\\\\Bla bla bla --> ./Bla bla bla",
		  "Bla bla bla --> Bla bla bla",
		  "C:\\something\\something\\/**/*.md --> C:/something/something/**/*.md",
		  "C:\\something\\something\\/**/*.md --> C:/something/something/**/*.md",
		  "C:\\something\\something\\/**/*.md --> C:/something/something/**/*.md",
		  "C:/something/something//**/*.md --> C:/something/something/**/*.md",
		  "C:\\\\something\\\\something\\\\/**/*.md --> C:/something/something/**/*.md",
		  "../yes --> ../yes",
		  "C:\\Bla bla bla --> C:/Bla bla bla",
		  "C:\\\\Bla bla bla --> C:/Bla bla bla",
		  "C:\\\\Bla bla bla\\\\some file.txt --> C:/Bla bla bla/some file.txt",
		  "d:\\Bla bla bla --> d:/Bla bla bla",
		  "z:\\Bla bla bla --> z:/Bla bla bla",
		  "C:\\Bla bla bla --> C:/Bla bla bla",
		  "C:\\\\Bla bla bla --> C:/Bla bla bla",
		  "C:\\\\Bla bla bla\\\\some file.txt --> C:/Bla bla bla/some file.txt",
		  "d:\\Bla bla bla --> d:/Bla bla bla",
		  "z:\\Bla bla bla --> z:/Bla bla bla",
		  "\\\\?\\Volume{abc123-abc123-abc123}\\\\ --> \\\\?\\Volume{abc123-abc123-abc123}\\\\",
		  "\\\\Server\\Share\\folder --> /Server/Share/folder",
		]
	`)
})

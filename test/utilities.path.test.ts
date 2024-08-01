import {
	getBaseAndQueryParts,
	isAbsolute,
	normalize,
	resolveWithBasePath,
} from '../src/lib/utilities/path'
import { expect, it } from 'vitest'

const testPathsRaw = [
	String.raw`C:/Bla bla bla`,
	String.raw`/Bla bla bla`,
	String.raw`../Bla bla bla`,
	String.raw`./Bla bla bla`,
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
	String.raw`C:/Bla bla bla#some#stuff`,
	String.raw`/Bla bla bla#stuff`,
	String.raw`Bla bla bla#stuff`,
	String.raw`./Bla bla bla#stuff`,
	String.raw`../Bla bla bla^block`,
	String.raw`./Bla bla bla?query=yes`,
	String.raw`/path/Bla bla bla#stuff`,
	String.raw`/path/../Bla bla bla#stuff`,
	String.raw`./more/Bla bla bla.config.yes#stuff`,
	String.raw`../Bla bla bla.txt^block`,
	String.raw`./Bla bla bla?query=yes`,
]

const testPathsNormalized = testPathsRaw.map((path) => normalize(path))

it('detects absolute paths', () => {
	const results = testPathsNormalized.map(
		(path) => `${path} --> ${isAbsolute(path) ? 'absolute' : 'relative'}`,
	)

	expect(results).toMatchInlineSnapshot(`
		[
		  "C:/Bla bla bla --> absolute",
		  "/Bla bla bla --> absolute",
		  "../Bla bla bla --> relative",
		  "./Bla bla bla --> relative",
		  "Bla bla bla --> relative",
		  "C:/something/something/**/*.md --> absolute",
		  "C:/something/something/**/*.md --> absolute",
		  "C:/something/something/**/*.md --> absolute",
		  "C:/something/something/**/*.md --> absolute",
		  "C:/something/something/**/*.md --> absolute",
		  "../yes --> relative",
		  "C:/Bla bla bla --> absolute",
		  "C:/Bla bla bla --> absolute",
		  "C:/Bla bla bla/some file.txt --> absolute",
		  "d:/Bla bla bla --> absolute",
		  "z:/Bla bla bla --> absolute",
		  "C:/Bla bla bla --> absolute",
		  "C:/Bla bla bla --> absolute",
		  "C:/Bla bla bla/some file.txt --> absolute",
		  "d:/Bla bla bla --> absolute",
		  "z:/Bla bla bla --> absolute",
		  "\\\\?\\Volume{abc123-abc123-abc123}\\\\ --> absolute",
		  "/Server/Share/folder --> absolute",
		  "C:/Bla bla bla#some#stuff --> absolute",
		  "/Bla bla bla#stuff --> absolute",
		  "Bla bla bla#stuff --> relative",
		  "./Bla bla bla#stuff --> relative",
		  "../Bla bla bla^block --> relative",
		  "./Bla bla bla?query=yes --> relative",
		  "/path/Bla bla bla#stuff --> absolute",
		  "/Bla bla bla#stuff --> absolute",
		  "./more/Bla bla bla.config.yes#stuff --> relative",
		  "../Bla bla bla.txt^block --> relative",
		  "./Bla bla bla?query=yes --> relative",
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
		  "C:/Bla bla bla#some#stuff --> C:/Bla bla bla#some#stuff",
		  "/Bla bla bla#stuff --> /Bla bla bla#stuff",
		  "Bla bla bla#stuff --> Bla bla bla#stuff",
		  "./Bla bla bla#stuff --> ./Bla bla bla#stuff",
		  "../Bla bla bla^block --> ../Bla bla bla^block",
		  "./Bla bla bla?query=yes --> ./Bla bla bla?query=yes",
		  "/path/Bla bla bla#stuff --> /path/Bla bla bla#stuff",
		  "/path/../Bla bla bla#stuff --> /Bla bla bla#stuff",
		  "./more/Bla bla bla.config.yes#stuff --> ./more/Bla bla bla.config.yes#stuff",
		  "../Bla bla bla.txt^block --> ../Bla bla bla.txt^block",
		  "./Bla bla bla?query=yes --> ./Bla bla bla?query=yes",
		]
	`)
})

it('gets base and query', () => {
	const results = testPathsNormalized.map(
		(path) => `${path} --> ${String(getBaseAndQueryParts(path))}`,
	)
	expect(results).toMatchInlineSnapshot(`
		[
		  "C:/Bla bla bla --> C:/Bla bla bla,",
		  "/Bla bla bla --> /Bla bla bla,",
		  "../Bla bla bla --> ../Bla bla bla,",
		  "./Bla bla bla --> Bla bla bla,",
		  "Bla bla bla --> Bla bla bla,",
		  "C:/something/something/**/*.md --> C:/something/something/**/*.md,",
		  "C:/something/something/**/*.md --> C:/something/something/**/*.md,",
		  "C:/something/something/**/*.md --> C:/something/something/**/*.md,",
		  "C:/something/something/**/*.md --> C:/something/something/**/*.md,",
		  "C:/something/something/**/*.md --> C:/something/something/**/*.md,",
		  "../yes --> ../yes,",
		  "C:/Bla bla bla --> C:/Bla bla bla,",
		  "C:/Bla bla bla --> C:/Bla bla bla,",
		  "C:/Bla bla bla/some file.txt --> C:/Bla bla bla/some file.txt,",
		  "d:/Bla bla bla --> d:/Bla bla bla,",
		  "z:/Bla bla bla --> z:/Bla bla bla,",
		  "C:/Bla bla bla --> C:/Bla bla bla,",
		  "C:/Bla bla bla --> C:/Bla bla bla,",
		  "C:/Bla bla bla/some file.txt --> C:/Bla bla bla/some file.txt,",
		  "d:/Bla bla bla --> d:/Bla bla bla,",
		  "z:/Bla bla bla --> z:/Bla bla bla,",
		  "\\\\?\\Volume{abc123-abc123-abc123}\\\\ --> \\\\,?\\Volume{abc123-abc123-abc123}\\\\",
		  "/Server/Share/folder --> /Server/Share/folder,",
		  "C:/Bla bla bla#some#stuff --> C:/Bla bla bla,#some#stuff",
		  "/Bla bla bla#stuff --> /Bla bla bla,#stuff",
		  "Bla bla bla#stuff --> Bla bla bla,#stuff",
		  "./Bla bla bla#stuff --> Bla bla bla,#stuff",
		  "../Bla bla bla^block --> ../Bla bla bla,^block",
		  "./Bla bla bla?query=yes --> Bla bla bla,?query=yes",
		  "/path/Bla bla bla#stuff --> /path/Bla bla bla,#stuff",
		  "/Bla bla bla#stuff --> /Bla bla bla,#stuff",
		  "./more/Bla bla bla.config.yes#stuff --> more/Bla bla bla.config.yes,#stuff",
		  "../Bla bla bla.txt^block --> ../Bla bla bla.txt,^block",
		  "./Bla bla bla?query=yes --> Bla bla bla,?query=yes",
		]
	`)
})

it('resolves with base path', () => {
	expect(
		resolveWithBasePath('./foo/bar/baz.md', { basePath: '/yes/foo/', cwd: '/yes/foo/oh/really/' }),
	).toMatchInlineSnapshot(`"/yes/foo/oh/really/foo/bar/baz.md"`)

	expect(
		resolveWithBasePath('/yes/foo/oh/really/foo/bar/baz.md', {
			basePath: '/yes/foo/',
			cwd: '/yes/foo/oh/really/',
		}),
	).toMatchInlineSnapshot(`"/yes/foo/oh/really/foo/bar/baz.md"`)

	expect(
		resolveWithBasePath('./foo/bar/baz.md', {
			basePath: 'C:/yes/foo/',
			cwd: 'C:/yes/foo/oh/really/',
		}),
	).toMatchInlineSnapshot(`"C:/yes/foo/oh/really/foo/bar/baz.md"`)

	expect(
		resolveWithBasePath('C:/yes/foo/oh/really/foo/bar/buz.md', {
			basePath: 'C:/yes/foo/',
			cwd: 'C:/yes/foo/oh/really/',
		}),
	).toMatchInlineSnapshot(`"C:/yes/foo/oh/really/foo/bar/buz.md"`)
})

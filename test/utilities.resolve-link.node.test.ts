import { expect, it } from 'vitest'
import { resolveLink } from '../src/lib/utilities/resolve-link'
import { permute } from './utilities/permute'

it('resolves links', () => {
	// TODO windows
	const linksToResolve = [
		'./assets/test-obsidian-vault/test card.md',
		'./assets/test-obsidian-vault/test card',
		'./assets/test-obsidian-vault/test%20card.md',
		'./assets/test-obsidian-vault/test%20card',
		'/base-path/cwd/assets/test-obsidian-vault/test card.md',
		'/base-path/cwd/assets/test-obsidian-vault/test%20card.md',
	]

	for (const link of linksToResolve) {
		const resolved = resolveLink(link, {
			allFilePaths: ['/base-path/cwd/assets/test-obsidian-vault/test card.md'],
			cwd: '/base-path/cwd/',
			type: 'link',
		})

		expect(resolved).toBe('/base-path/cwd/assets/test-obsidian-vault/test card.md')
	}
})

it('resolves a named file link', () => {
	expect(
		resolveLink('test pdf.pdf', {
			allFilePaths: ['/base-path/cwd/test/assets/test-obsidian-vault/Assets/test pdf.pdf'],
			convertFilePathsToProtocol: 'obsidian',
			cwd: '/base-path/cwd/',
			obsidianVaultName: 'test-obsidian-vault',
			type: 'link',
		}),
	).toMatchInlineSnapshot(
		`"obsidian://open?vault=test-obsidian-vault&file=%2Fbase-path%2Fcwd%2Ftest%2Fassets%2Ftest-obsidian-vault%2FAssets%2Ftest%20pdf.pdf"`,
	)
})

it('resolves wiki links', () => {
	expect(
		resolveLink('pandas-DataFrame-xs', {
			allFilePaths: ['/base-path/cwd/test/assets/test-obsidian-vault/pandas-DataFrame-xs.md'],
			convertFilePathsToProtocol: 'obsidian',
			cwd: '/base-path/cwd/',
			obsidianVaultName: 'test-obsidian-vault',
			type: 'link',
		}),
	).toMatchInlineSnapshot(
		`"obsidian://open?vault=test-obsidian-vault&file=%2Fbase-path%2Fcwd%2Ftest%2Fassets%2Ftest-obsidian-vault%2Fpandas-DataFrame-xs.md"`,
	)
})

// https://github.com/kitschpatrol/yanki-obsidian/issues/42
it('resolves wiki links with many dots and a good extension', () => {
	expect(
		resolveLink('pandas.DataFrame.xs.md', {
			allFilePaths: ['/base-path/cwd/test/assets/test-obsidian-vault/pandas.DataFrame.xs.md'],
			convertFilePathsToProtocol: 'obsidian',
			cwd: '/base-path/cwd/',
			obsidianVaultName: 'test-obsidian-vault',
			type: 'link',
		}),
	).toMatchInlineSnapshot(
		`"obsidian://open?vault=test-obsidian-vault&file=%2Fbase-path%2Fcwd%2Ftest%2Fassets%2Ftest-obsidian-vault%2Fpandas.DataFrame.xs.md"`,
	)
})

// https://github.com/kitschpatrol/yanki-obsidian/issues/42
it('resolves wiki links with many dots and a weird extension', () => {
	expect(
		resolveLink('pandas.DataFrame.xs', {
			allFilePaths: ['/base-path/cwd/test/assets/test-obsidian-vault/pandas.DataFrame.xs.md'],
			convertFilePathsToProtocol: 'obsidian',
			cwd: '/base-path/cwd/',
			obsidianVaultName: 'test-obsidian-vault',
			type: 'link',
		}),
	).toMatchInlineSnapshot(
		`"obsidian://open?vault=test-obsidian-vault&file=%2Fbase-path%2Fcwd%2Ftest%2Fassets%2Ftest-obsidian-vault%2Fpandas.DataFrame.xs.md"`,
	)
})

it('resolves a named file link with a space in the vault name', () => {
	expect(
		resolveLink('test pdf.pdf', {
			allFilePaths: [
				'/base-path/cwd/test/assets/test obsidian vault with spaces/Assets/test pdf.pdf',
			],
			convertFilePathsToProtocol: 'obsidian',
			cwd: '/base-path/cwd/',
			obsidianVaultName: 'test obsidian vault with spaces',
			type: 'link',
		}),
	).toMatchInlineSnapshot(
		`"obsidian://open?vault=test%20obsidian%20vault%20with%20spaces&file=%2Fbase-path%2Fcwd%2Ftest%2Fassets%2Ftest%20obsidian%20vault%20with%20spaces%2FAssets%2Ftest%20pdf.pdf"`,
	)
})

it('resolves a named file embed', () => {
	expect(
		resolveLink('test card', {
			allFilePaths: ['/base-path/cwd/test/assets/test-obsidian-vault/test card.md'],
			cwd: '/base-path/cwd/',
			type: 'embed',
		}),
	).toMatchInlineSnapshot(`"/base-path/cwd/test/assets/test-obsidian-vault/test card.md"`)

	expect(
		resolveLink('test card', {
			allFilePaths: ['/base-path/cwd/test/assets/test-obsidian-vault/test card.md'],
			convertFilePathsToProtocol: 'obsidian',
			cwd: '/base-path/cwd/',
			obsidianVaultName: 'test-obsidian-vault',
			type: 'embed',
		}),
	).toMatchInlineSnapshot(
		`"obsidian://open?vault=test-obsidian-vault&file=%2Fbase-path%2Fcwd%2Ftest%2Fassets%2Ftest-obsidian-vault%2Ftest%20card.md"`,
	)

	expect(
		resolveLink('test pdf.pdf', {
			allFilePaths: ['/base-path/cwd/test/assets/test-obsidian-vault/Assets/test pdf.pdf'],
			convertFilePathsToProtocol: 'obsidian',
			cwd: '/base-path/cwd/',
			obsidianVaultName: 'test-obsidian-vault',
			type: 'embed',
		}),
	).toMatchInlineSnapshot(
		`"obsidian://open?vault=test-obsidian-vault&file=%2Fbase-path%2Fcwd%2Ftest%2Fassets%2Ftest-obsidian-vault%2FAssets%2Ftest%20pdf.pdf"`,
	)

	expect(
		resolveLink('test card', {
			allFilePaths: ['/base-path/cwd/test/assets/test-obsidian-vault/test card.md'],
			convertFilePathsToProtocol: 'file',
			cwd: '/base-path/cwd/',
			type: 'embed',
		}),
	).toMatchInlineSnapshot(`"file:///base-path/cwd/test/assets/test-obsidian-vault/test card.md"`)

	expect(
		resolveLink('test%20card', {
			allFilePaths: ['/base-path/cwd/test/assets/test-obsidian-vault/test card.md'],
			cwd: '/base-path/cwd/',
			type: 'embed',
		}),
	).toMatchInlineSnapshot(`"/base-path/cwd/test/assets/test-obsidian-vault/test card.md"`)

	expect(
		resolveLink('test%20card.md', {
			allFilePaths: ['/base-path/cwd/test/assets/test-obsidian-vault/test card.md'],
			cwd: '/base-path/cwd/',
			type: 'embed',
		}),
	).toMatchInlineSnapshot(`"/base-path/cwd/test/assets/test-obsidian-vault/test card.md"`)
})

it('resolves a relative file path with intermediate relative paths', () => {
	expect(
		resolveLink('./assets/test-obsidian-vault/../test-obsidian-vault/test card.md', {
			cwd: '/base-path/cwd/',
			type: 'link',
		}),
	).toMatchInlineSnapshot(`"/base-path/cwd/assets/test-obsidian-vault/test card.md"`)
})

it('resolves a relative file path without an extension', () => {
	// The allFilePaths option is hard-coded for the browser test, since globby
	// has Node dependencies
	expect(
		resolveLink('./test/assets/test-obsidian-vault/test card', {
			allFilePaths: ['/base-path/cwd/test/assets/test-obsidian-vault/test card.md'],
			cwd: '/base-path/cwd/',
			type: 'link',
		}),
	).toMatchInlineSnapshot(`"/base-path/cwd/test/assets/test-obsidian-vault/test card.md"`)
})

it('resolves a relative file path without an extension with dots in the name', () => {
	// The allFilePaths option is hard-coded for the browser test, since globby
	// has Node dependencies
	expect(
		resolveLink('./test/assets/test-obsidian-vault/te.st ca.rd', {
			allFilePaths: ['/base-path/cwd/test/assets/test-obsidian-vault/te.st ca.rd.md'],
			cwd: '/base-path/cwd/',
			type: 'link',
		}),
	).toMatchInlineSnapshot(`"/base-path/cwd/test/assets/test-obsidian-vault/te.st ca.rd.md"`)
})

it('resolves relative file paths', () => {
	// The allFilePaths option is hard-coded for the browser test, since globby
	// has Node dependencies
	const allFilePaths = [
		'/base-path/cwd/test/assets/test-obsidian-vault/test card.md',
		'/base-path/cwd/test/assets/test-obsidian-vault/Wiki Links/test card.md',
		'/base-path/cwd/test/assets/test-obsidian-vault/Cards/Group 1/test card.md',
		'/base-path/cwd/test/assets/test-obsidian-vault/Cards/Group 2/test card.md',
		'/base-path/cwd/test/assets/test-obsidian-vault/Wiki Links/Nested/test card.md',
		'/base-path/cwd/test/assets/test-obsidian-vault/Cards/Group 1/Sub Group/test card.md',
		'/base-path/cwd/test/assets/test-obsidian-vault/Wiki Links/Nested/Nested/test card.md',
	]

	// Node approach
	// const allRelativeFilePaths = await globby('./test/assets/test-obsidian-vault/**/*')
	// const allFilePaths = allRelativeFilePaths.map((filePath) =>
	// 	filePath.replace('./', '/base-path/cwd/'),
	// )

	const testPaths = permute(
		[
			'./test/assets/test-obsidian-vault/',
			'.\\test\\assets\\test-obsidian-vault\\',
			'../cwd/test/assets/test-obsidian-vault/',
			'..\\cwd\\test\\assets\\test-obsidian-vault\\',
		],
		['test card', 'test%20card'],
		['.md', ''],
		['^34876', '#bla', '#bla#bla', '?foo=bar', '?foo=bar%20baz', ''],
	)

	const resolvedTestPaths = [...testPaths].map((testPath) =>
		resolveLink(testPath, {
			allFilePaths,
			cwd: '/base-path/cwd/',
			type: 'link',
		}),
	)

	expect(
		allCorrect(
			testPaths,
			resolvedTestPaths,
			'/base-path/cwd/test/assets/test-obsidian-vault/test card.md',
		),
	).toBeTruthy()
})

function allCorrect(testPaths: string[], resolvedTestPaths: string[], test: string) {
	if (testPaths.length !== resolvedTestPaths.length) {
		console.error(`Length mismatch: ${testPaths.length} !== ${resolvedTestPaths.length}`)
		return false
	}

	let allCorrect = true
	for (const [i, resolvedTestPath] of resolvedTestPaths.entries()) {
		if (resolvedTestPath !== test) {
			allCorrect = false
			console.error(`Error resolving: ${testPaths[i]} --> ${resolvedTestPath}`)
		}
	}

	return allCorrect
}

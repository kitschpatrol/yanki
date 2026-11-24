import { expect, it, vi } from 'vitest'
import { parseObsidianVaultLink, resolveLink } from '../src/lib/utilities/resolve-link'
import { countReads } from './utilities/count-reads'
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

// https://github.com/kitschpatrol/yanki-obsidian/issues/88
// A wiki link must not resolve to a different file whose name merely ends with
// the linked name, even when that file sorts first alphabetically
it('resolves wiki links to the exact file name instead of a file name with the same suffix', () => {
	/* Spell-checker:disable */
	const allFilePaths = [
		'/base-path/vault/Anki/anki-note.md',
		'/base-path/vault/Some Folder/Bindegewebe.md',
		'/base-path/vault/Some Folder/Gewebe.md',
	]

	expect(
		resolveLink('Gewebe', {
			allFilePaths,
			basePath: '/base-path/vault',
			convertFilePathsToProtocol: 'obsidian',
			cwd: '/base-path/vault/Anki',
			obsidianVaultName: 'test-vault',
			type: 'link',
		}),
	).toBe('obsidian://open?vault=test-vault&file=%2FSome%20Folder%2FGewebe.md')
	/* Spell-checker:enable */
})

/**
 * Resolve a link from a note in a vault at `/vault`, and get the vault path of
 * the matched file, or undefined if the link didn't match one.
 */
function resolveInVault(
	link: string,
	vaultPaths: string[],
	sourceDirectory = '',
): string | undefined {
	const resolved = resolveLink(link, {
		allFilePaths: vaultPaths.map((vaultPath) => `/vault/${vaultPath}`),
		basePath: '/vault',
		convertFilePathsToProtocol: 'obsidian',
		cwd: sourceDirectory === '' ? '/vault' : `/vault/${sourceDirectory}`,
		obsidianVaultName: 'vault',
		type: 'link',
	})

	// Only links that match a file become vault URLs, the rest fall back to a
	// plain path that may or may not exist
	return parseObsidianVaultLink(resolved)?.linkPath.slice(1)
}

// The expectations in the tests below mirror `MetadataCache.getLinkpathDest()`
// in Obsidian 1.15.1, which resolves wiki links and Markdown links alike

it('only considers files with exactly the linked name', () => {
	/* Spell-checker:disable */
	// A file name that merely ends with the linked name is never a match, even
	// where it would otherwise be preferred for its shorter path
	expect(resolveInVault('Gewebe', ['Bindegewebe.md', 'Some Folder/Gewebe.md'])).toBe(
		'Some Folder/Gewebe.md',
	)
	expect(resolveInVault('Gewebe', ['Bindegewebe.md'])).toBeUndefined()
	expect(resolveInVault('Folder/Gewebe', ['Folder/Bindegewebe.md'])).toBeUndefined()
	expect(resolveInVault('./Gewebe', ['Bindegewebe.md'])).toBeUndefined()
	expect(resolveInVault('/Gewebe', ['Bindegewebe.md'])).toBeUndefined()
	expect(resolveInVault('ewebe.md', ['Gewebe.md'])).toBeUndefined()
	/* Spell-checker:enable */
})

it('matches file names without regard to case, and returns the case of the file', () => {
	/* Spell-checker:disable */
	expect(resolveInVault('GEWEBE', ['Folder/Gewebe.md'])).toBe('Folder/Gewebe.md')
	expect(resolveInVault('folder/gewebe.MD', ['Folder/Gewebe.md'])).toBe('Folder/Gewebe.md')
	expect(resolveInVault('./folder/GEWEBE', ['Folder/Gewebe.md'])).toBe('Folder/Gewebe.md')
	/* Spell-checker:enable */
})

it('only appends a Markdown extension when no file has the exact linked name', () => {
	const vaultPaths = ['Assets/diagram.png', 'Notes/diagram.png.md', 'Notes/version 1.2.md']

	expect(resolveInVault('diagram.png', vaultPaths)).toBe('Assets/diagram.png')
	expect(resolveInVault('diagram.png.md', vaultPaths)).toBe('Notes/diagram.png.md')
	expect(resolveInVault('version 1.2', vaultPaths)).toBe('Notes/version 1.2.md')

	// A name without a dot is always a note, never a file without an extension
	expect(resolveInVault('LICENSE', ['LICENSE'])).toBeUndefined()
	expect(resolveInVault('LICENSE', ['LICENSE', 'Notes/LICENSE.md'])).toBe('Notes/LICENSE.md')
})

it('resolves a path from the vault root before any other file with the same name', () => {
	const vaultPaths = [
		'Archive/Notes/topic.md',
		'Archive/topic.md',
		'Notes/topic.md',
		'topic.md',
		'Work/Notes/topic.md',
	]

	// Even from a directory with nearer matches
	expect(resolveInVault('topic', vaultPaths, 'Archive')).toBe('topic.md')
	expect(resolveInVault('Notes/topic', vaultPaths, 'Archive')).toBe('Notes/topic.md')
	expect(resolveInVault('/Notes/topic', vaultPaths, 'Archive')).toBe('Notes/topic.md')
})

it('prefers files under the linking directory, then shorter paths, then earlier files', () => {
	const vaultPaths = [
		'Projects/Alpha/Deep/Deeper/image.png',
		'Projects/Beta/image.png',
		'Projects/Alpha/Deep/image.png',
		'Zeta/image.png',
		'Yoga/image.png',
	]

	// Under the linking directory, the shortest path wins
	expect(resolveInVault('image.png', vaultPaths, 'Projects/Alpha')).toBe(
		'Projects/Alpha/Deep/image.png',
	)

	// A file elsewhere is not preferred, however near it is
	expect(resolveInVault('image.png', vaultPaths, 'Projects/Alpha/Deep/Deeper')).toBe(
		'Projects/Alpha/Deep/Deeper/image.png',
	)

	// With nothing under the linking directory, the shortest path wins, and
	// paths of equal length resolve in the order they're listed
	expect(resolveInVault('image.png', vaultPaths, 'Elsewhere')).toBe('Zeta/image.png')
	expect(resolveInVault('image.png', vaultPaths.toReversed(), 'Elsewhere')).toBe('Yoga/image.png')

	// Obsidian compares the start of the whole path, not whole directory names
	expect(resolveInVault('image.png', vaultPaths, 'Proj')).toBe('Projects/Beta/image.png')
})

it('resolves partial paths by suffix, including partial directory names', () => {
	const vaultPaths = ['Cards/Group 1/note.md', 'Cards/Group 2/note.md', 'Cards/Group 12/note.md']

	expect(resolveInVault('Group 2/note', vaultPaths)).toBe('Cards/Group 2/note.md')
	expect(resolveInVault('Group 12/note', vaultPaths)).toBe('Cards/Group 12/note.md')

	// Obsidian compares the end of the whole path, not whole directory names
	expect(resolveInVault('oup 1/note', vaultPaths)).toBe('Cards/Group 1/note.md')
})

it('resolves relative links from the linking directory, stopping at the vault root', () => {
	const vaultPaths = ['note.md', 'Cards/note.md', 'Cards/Group/note.md', 'Other/note.md']

	expect(resolveInVault('./note', vaultPaths, 'Cards')).toBe('Cards/note.md')
	expect(resolveInVault('./Group/note', vaultPaths, 'Cards')).toBe('Cards/Group/note.md')
	expect(resolveInVault('../note', vaultPaths, 'Cards/Group')).toBe('Cards/note.md')
	expect(resolveInVault('../Other/note', vaultPaths, 'Cards')).toBe('Other/note.md')
	expect(resolveInVault('./../Other/note', vaultPaths, 'Cards')).toBe('Other/note.md')

	// Obsidian can't leave the vault, so surplus ascents are ignored
	expect(resolveInVault('../../../note', vaultPaths, 'Cards')).toBe('note.md')
})

it('falls back to matching by suffix when a relative link leads nowhere', () => {
	const vaultPaths = ['Cards/Group 1/note.md', 'Archive/Cards/Group 2/note.md']

	expect(resolveInVault('./Group 2/note', vaultPaths, 'Cards')).toBe(
		'Archive/Cards/Group 2/note.md',
	)
	expect(resolveInVault('./note', vaultPaths)).toBe('Cards/Group 1/note.md')
})

it('never falls back to matching by suffix for links starting with a slash', () => {
	const vaultPaths = ['Cards/note.md', 'Cards/unique.md']

	expect(resolveInVault('/Cards/note', vaultPaths)).toBe('Cards/note.md')
	expect(resolveInVault('/note', vaultPaths)).toBeUndefined()
	expect(resolveInVault('/unique', vaultPaths)).toBeUndefined()

	// Without the slash, the same links do fall back
	expect(resolveInVault('note', vaultPaths)).toBe('Cards/note.md')
	expect(resolveInVault('unique', vaultPaths)).toBe('Cards/unique.md')
})

it('resolves absolute file system paths that Obsidian would not', () => {
	const vaultPaths = ['Cards/note.md', 'Cards/image.png']

	expect(resolveInVault('/vault/Cards/note.md', vaultPaths)).toBe('Cards/note.md')
	expect(resolveInVault('/vault/Cards/note', vaultPaths)).toBe('Cards/note.md')
	expect(resolveInVault('file:///vault/Cards/image.png', vaultPaths)).toBe('Cards/image.png')
})

it('resolves links without a path to the file they are in', () => {
	const options: Parameters<typeof resolveLink>[1] = {
		allFilePaths: ['/vault/Cards/note.md', '/vault/note.md'],
		basePath: '/vault',
		convertFilePathsToProtocol: 'obsidian',
		cwd: '/vault/Cards',
		obsidianVaultName: 'vault',
		sourcePath: '/vault/Cards/note.md',
		type: 'link',
	}
	const vaultUrl = (linkPath: string) =>
		`obsidian://open?vault=vault&file=${encodeURIComponent(linkPath)}`

	expect(resolveLink('#Heading', options)).toBe(vaultUrl('/Cards/note.md#Heading'))
	expect(resolveLink('#Heading#Subheading', options)).toBe(
		vaultUrl('/Cards/note.md#Heading#Subheading'),
	)
	expect(resolveLink('#^block', options)).toBe(vaultUrl('/Cards/note.md#^block'))
	expect(resolveLink('#Heading/With a slash', options)).toBe(
		vaultUrl('/Cards/note.md#Heading/With a slash'),
	)
	expect(resolveLink('#Heading', { ...options, type: 'embed' })).toBe(
		vaultUrl('/Cards/note.md#Heading'),
	)

	// Plain paths never carry anchors
	expect(resolveLink('#Heading', { ...options, convertFilePathsToProtocol: 'none' })).toBe(
		'/vault/Cards/note.md',
	)

	// A path still leads to the file with that name, not back to the source
	expect(resolveLink('/note#Heading', options)).toBe(vaultUrl('/note.md#Heading'))
})

it('leaves links without a path unresolved when the file they are in is unknown', () => {
	const resolved = resolveLink('#Heading', {
		allFilePaths: ['/vault/Cards/note.md'],
		basePath: '/vault',
		convertFilePathsToProtocol: 'obsidian',
		cwd: '/vault/Cards',
		obsidianVaultName: 'vault',
		type: 'link',
	})

	expect(parseObsidianVaultLink(resolved)).toBeUndefined()
})

it('resolves links from the directory of the source path instead of the working directory', () => {
	const options: Parameters<typeof resolveLink>[1] = {
		allFilePaths: ['/vault/Cards/image.png', '/vault/Cards/peer.md', '/vault/Notes/image.png'],
		// A stale working directory must not matter
		cwd: '/vault/Notes',
		sourcePath: '/vault/Cards/note.md',
		type: 'link',
	}

	expect(resolveLink('./peer', options)).toBe('/vault/Cards/peer.md')
	expect(resolveLink('image.png', options)).toBe('/vault/Cards/image.png')
	expect(resolveLink('missing', options)).toBe('/vault/Cards/missing')
})

it.each([
	{ basePath: '/vault', name: 'with a known vault root' },
	{ basePath: undefined, name: 'with a stand-in vault root' },
])(
	'reads a list of file paths once for all the links resolved against it, $name',
	({ basePath }) => {
		const filePaths = Array.from(
			{ length: 500 },
			(_, index) => `/vault/folder-${index % 10}/note-${index}.md`,
		)
		const { countedItems, getReads } = countReads(filePaths)

		for (let index = 0; index < 100; index++) {
			expect(
				resolveLink(`note-${index}`, {
					allFilePaths: countedItems,
					basePath,
					cwd: '/vault/folder-1',
					type: 'link',
				}),
			).toBe(`/vault/folder-${index % 10}/note-${index}.md`)
		}

		// One pass over the list, plus a read of each matched file
		expect(getReads()).toBeLessThan(filePaths.length * 2)
	},
)

it('finds a file added to the list after an earlier link was resolved against it', () => {
	const allFilePaths = ['/vault/first.md']
	const resolve = (link: string) =>
		resolveLink(link, { allFilePaths, basePath: '/vault', cwd: '/vault', type: 'link' })

	expect(resolve('first')).toBe('/vault/first.md')
	expect(resolve('second')).toBe('/vault/second')

	allFilePaths.push('/vault/Deep/second.md')
	expect(resolve('second')).toBe('/vault/Deep/second.md')
})

it('resolves an absolute file system path to the first listed file when paths differ only by case', () => {
	const allFilePaths = ['/vault/Cards/Note.md', '/vault/Cards/note.md']
	const resolve = (link: string) =>
		resolveLink(link, { allFilePaths, basePath: '/vault', cwd: '/vault', type: 'link' })

	// Not a path from the vault root, so the file system path is looked up as is
	expect(resolve('/vault/Cards/note.md')).toBe('/vault/Cards/Note.md')
	expect(resolve('/vault/Cards/NOTE')).toBe('/vault/Cards/Note.md')
})

it('keeps the files of separate lists apart', () => {
	const resolve = (allFilePaths: string[]) =>
		resolveLink('note', { allFilePaths, basePath: '/vault', cwd: '/vault', type: 'link' })

	expect(resolve(['/vault/One/note.md'])).toBe('/vault/One/note.md')
	expect(resolve(['/vault/Two/note.md'])).toBe('/vault/Two/note.md')
})

it('treats the deepest directory containing every file as the vault root when none is given', () => {
	const allFilePaths = [
		'/synced/Assets/image.png',
		'/synced/Cards/Group/note.md',
		'/synced/Cards/image.png',
		'/synced/Cards/note.md',
		'/synced/note.md',
	]
	const resolve = (link: string, cwd: string) =>
		resolveLink(link, { allFilePaths, cwd, type: 'link' })

	// A path from the stand-in root wins, as it would from a real vault root
	expect(resolve('note', '/synced/Cards/Group')).toBe('/synced/note.md')
	expect(resolve('Cards/note', '/synced/Cards/Group')).toBe('/synced/Cards/note.md')
	expect(resolve('/Cards/note', '/synced/Cards/Group')).toBe('/synced/Cards/note.md')
	expect(resolve('/Assets/image.png', '/synced/Cards')).toBe('/synced/Assets/image.png')

	// The rest of Obsidian's rules still apply
	expect(resolve('image.png', '/synced/Assets')).toBe('/synced/Assets/image.png')
	expect(resolve('image.png', '/synced/Cards/Group')).toBe('/synced/Cards/image.png')
	expect(resolve('./note', '/synced/Cards/Group')).toBe('/synced/Cards/Group/note.md')

	// But a stand-in root is only a guess, so relative links can lead above it
	expect(resolve('../../../synced/Cards/note', '/synced/Cards/Group')).toBe('/synced/Cards/note.md')
	expect(resolve('../synced/Assets/image.png', '/synced')).toBe('/synced/Assets/image.png')
})

// Question marks are valid in note file names on macOS and Linux
//https://github.com/kitschpatrol/yanki/issues/20
it('resolves file paths with question marks in their names', () => {
	expect(
		resolveLink('Cards/How much is 2+2=?.md', {
			allFilePaths: ['/base-path/vault/Cards/How much is 2+2=?.md'],
			basePath: '/base-path/vault',
			cwd: '/base-path/vault/Cards',
			type: 'link',
		}),
	).toBe('/base-path/vault/Cards/How much is 2+2=?.md')
})

//https://github.com/kitschpatrol/yanki/issues/20
it('resolves file paths with question marks in their names to obsidian URLs', () => {
	expect(
		resolveLink('Cards/How much is 2+2=?.md', {
			allFilePaths: ['/base-path/vault/Cards/How much is 2+2=?.md'],
			basePath: '/base-path/vault',
			convertFilePathsToProtocol: 'obsidian',
			cwd: '/base-path/vault/Cards',
			obsidianVaultName: 'test-vault',
			type: 'link',
		}),
	).toBe('obsidian://open?vault=test-vault&file=%2FCards%2FHow%20much%20is%202%2B2%3D%3F.md')
})

//https://github.com/kitschpatrol/yanki/issues/20
it('resolves wiki name links with question marks in their names', () => {
	expect(
		resolveLink('How much is 2+2=?', {
			allFilePaths: ['/base-path/vault/Cards/How much is 2+2=?.md'],
			basePath: '/base-path/vault',
			convertFilePathsToProtocol: 'obsidian',
			cwd: '/base-path/vault/Cards',
			obsidianVaultName: 'test-vault',
			type: 'link',
		}),
	).toBe('obsidian://open?vault=test-vault&file=%2FCards%2FHow%20much%20is%202%2B2%3D%3F.md')
})

//https://github.com/kitschpatrol/yanki/issues/20
it('resolves relative file paths with question marks in their names', () => {
	expect(
		resolveLink('./How much is 2+2=?.md', {
			allFilePaths: ['/base-path/vault/Cards/How much is 2+2=?.md'],
			basePath: '/base-path/vault',
			convertFilePathsToProtocol: 'obsidian',
			cwd: '/base-path/vault/Cards',
			obsidianVaultName: 'test-vault',
			type: 'link',
		}),
	).toBe('obsidian://open?vault=test-vault&file=%2FCards%2FHow%20much%20is%202%2B2%3D%3F.md')
})

//https://github.com/kitschpatrol/yanki/issues/20
it('resolves heading anchors on wiki name links with question marks in their names', () => {
	expect(
		resolveLink('How much is 2+2=?#Some heading', {
			allFilePaths: ['/base-path/vault/Cards/How much is 2+2=?.md'],
			basePath: '/base-path/vault',
			convertFilePathsToProtocol: 'obsidian',
			cwd: '/base-path/vault/Cards',
			obsidianVaultName: 'test-vault',
			type: 'link',
		}),
	).toBe(
		'obsidian://open?vault=test-vault&file=%2FCards%2FHow%20much%20is%202%2B2%3D%3F.md%23Some%20heading',
	)
})

it('resolves heading anchors containing slashes and Unicode', () => {
	const allFilePaths = [
		'/base-path/vault/Cards/✓Test Card 1 ?.md',
		'/base-path/vault/Notes/Mobile Communication Protocols (Monolith Note).md',
	]
	const links = [
		{
			source: 'Mobile Communication Protocols (Monolith Note)#2G/EDGE Heading',
			target: '/Notes/Mobile Communication Protocols (Monolith Note).md#2G/EDGE Heading',
		},
		{
			source: 'Mobile Communication Protocols (Monolith Note)#✓ 5G/LTE Heading',
			target: '/Notes/Mobile Communication Protocols (Monolith Note).md#✓ 5G/LTE Heading',
		},
		{
			source: '✓Test Card 1 ?#Pareto Principle (80/20 Rule)',
			target: '/Cards/✓Test Card 1 ?.md#Pareto Principle (80/20 Rule)',
		},
		{
			source: "✓Test Card 1 ?#✓ ISP's Gray IP/NAT Bypassing for self-hosting",
			target: "/Cards/✓Test Card 1 ?.md#✓ ISP's Gray IP/NAT Bypassing for self-hosting",
		},
	]

	const resolvedLinks = links.map(({ source }) =>
		resolveLink(source, {
			allFilePaths,
			basePath: '/base-path/vault',
			convertFilePathsToProtocol: 'obsidian',
			cwd: '/base-path/vault/Cards',
			obsidianVaultName: 'test-vault',
			type: 'link',
		}),
	)
	const expectedLinks = links.map(
		({ target }) => `obsidian://open?vault=test-vault&file=${encodeURIComponent(target)}`,
	)

	expect(resolvedLinks).toEqual(expectedLinks)
})

it('encodes non-ASCII symbols around slashes in headings and paths', () => {
	const symbols = '✓✘●○✅⛔️≠±⌥⌘^⎋▶︎▷❗️⚠️'
	const filePath = `/base-path/vault/${symbols} Notes/${symbols} Reference.md`
	const links = [
		{
			source: `../${symbols} Notes/${symbols} Reference#${symbols}/Heading`,
			target: `/${symbols} Notes/${symbols} Reference.md#${symbols}/Heading`,
		},
		{
			source: `../${symbols} Notes/${symbols} Reference#Heading/${symbols}`,
			target: `/${symbols} Notes/${symbols} Reference.md#Heading/${symbols}`,
		},
		{
			source: `../${symbols} Notes/${symbols} Reference#Before ${symbols}/After ${symbols}`,
			target: `/${symbols} Notes/${symbols} Reference.md#Before ${symbols}/After ${symbols}`,
		},
	]

	for (const { source, target } of links) {
		expect(
			resolveLink(source, {
				allFilePaths: [filePath],
				basePath: '/base-path/vault',
				convertFilePathsToProtocol: 'obsidian',
				cwd: '/base-path/vault/Cards',
				obsidianVaultName: 'test-vault',
				type: 'link',
			}),
		).toBe(`obsidian://open?vault=test-vault&file=${encodeURIComponent(target)}`)
	}
})

it('keeps path and anchor syntax separate while resolving ambiguous delimiters', () => {
	const allFilePaths = [
		'/base-path/vault/Cards/E = mc^2.md',
		'/base-path/vault/Notes#Archive/Protocol.md',
	]
	const links = [
		{
			source: 'Notes#Archive/Protocol',
			target: '/Notes#Archive/Protocol.md',
		},
		{
			source: '../Notes#Archive/Protocol#TCP/IP/../Details',
			target: '/Notes#Archive/Protocol.md#TCP/IP/../Details',
		},
		{
			source: './E = mc^2#Proof/Sketch',
			target: '/Cards/E = mc^2.md#Proof/Sketch',
		},
		{
			source: './E = mc^2^block/part',
			target: '/Cards/E = mc^2.md^block/part',
		},
	]

	const resolvedLinks = links.map(({ source }) =>
		resolveLink(source, {
			allFilePaths,
			basePath: '/base-path/vault',
			convertFilePathsToProtocol: 'obsidian',
			cwd: '/base-path/vault/Cards',
			obsidianVaultName: 'test-vault',
			type: 'link',
		}),
	)
	const expectedLinks = links.map(
		({ target }) => `obsidian://open?vault=test-vault&file=${encodeURIComponent(target)}`,
	)

	expect(resolvedLinks).toEqual(expectedLinks)
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
		['^34876', '#bla', '#bla#bla', ''],
	)

	const resolvedTestPaths = Array.from(testPaths, (testPath) =>
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

it('warns when obsidian protocol set without vault name', () => {
	const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()

	resolveLink('test card', {
		allFilePaths: ['/base-path/cwd/test card.md'],
		convertFilePathsToProtocol: 'obsidian',
		cwd: '/base-path/cwd/',
		type: 'link',
	})

	expect(spyWarn).toHaveBeenCalledWith(
		expect.stringContaining("convertFilePathsToProtocol is 'obsidian'"),
	)
	spyWarn.mockRestore()
})

it('resolves named links without matching file in allFilePaths', () => {
	// When there's no match, the name gets resolved via the base path
	// and then re-enters as a localFilePath
	const result = resolveLink('nonexistent note', {
		allFilePaths: [],
		cwd: '/base-path/cwd/',
		type: 'link',
	})

	// Should resolve to an absolute path via cwd
	expect(result).toContain('nonexistent note')
})

it('resolves file:// URLs to file paths', () => {
	expect(
		resolveLink('file:///base-path/cwd/test/assets/test card.md', {
			allFilePaths: ['/base-path/cwd/test/assets/test card.md'],
			cwd: '/base-path/cwd/',
			type: 'link',
		}),
	).toBe('/base-path/cwd/test/assets/test card.md')
})

it('returns obsidian URLs unchanged', () => {
	const obsidianUrl = 'obsidian://open?vault=test-vault&file=some%20note.md'

	expect(
		resolveLink(obsidianUrl, {
			cwd: '/base-path/cwd/',
			type: 'link',
		}),
	).toBe(obsidianUrl)
})

it('returns remote HTTP URLs unchanged', () => {
	expect(
		resolveLink('https://example.com/page', {
			cwd: '/base-path/cwd/',
			type: 'link',
		}),
	).toBe('https://example.com/page')

	expect(
		resolveLink('https://example.com/page', {
			cwd: '/base-path/cwd/',
			type: 'link',
		}),
	).toBe('https://example.com/page')
})

//https://github.com/kitschpatrol/yanki/issues/20
it('resolves file paths with question marks literally even without a file list', () => {
	// `?` is not an anchor delimiter, so it survives resolution even when
	// there's no list of real files to disambiguate against
	expect(
		resolveLink('./How much is 2+2=?.md', {
			allFilePaths: [],
			cwd: '/base-path/vault/Cards',
			type: 'link',
		}),
	).toBe('/base-path/vault/Cards/How much is 2+2=?.md')
})

it('returns remote HTTP URLs with queries and fragments unchanged', () => {
	// Remote URLs must never be subject to local path query / anchor handling
	const urlsWithQueries = [
		'https://example.com/page?foo=bar',
		'https://example.com/page?foo=bar&baz=qux',
		'https://example.com/page?foo=bar#fragment',
		'https://example.com/search?q=how%20much%20is%202%2B2%3D%3F',
		// eslint-disable-next-line unicorn/prefer-https -- Intentionally testing the http: protocol branch
		'http://example.com/page?foo=bar',
	]

	for (const url of urlsWithQueries) {
		expect(
			resolveLink(url, {
				allFilePaths: ['/base-path/cwd/test card.md'],
				basePath: '/base-path/cwd',
				convertFilePathsToProtocol: 'obsidian',
				cwd: '/base-path/cwd/',
				obsidianVaultName: 'test-vault',
				type: 'link',
			}),
		).toBe(url)
	}
})

it('warns for unsupported protocol URLs', () => {
	const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()

	const result = resolveLink('ftp://example.com/file', {
		cwd: '/base-path/cwd/',
		type: 'link',
	})

	expect(result).toBe('ftp://example.com/file')
	expect(spyWarn).toHaveBeenCalledWith(expect.stringContaining('Unsupported URL protocol'))
	spyWarn.mockRestore()
})

it('parses valid obsidian vault links', () => {
	/* Spell-checker:disable */
	const result = parseObsidianVaultLink('obsidian://open?vault=my-vault&file=path%2Fto%2Fnote.md')
	/* Spell-checker:enable */
	expect(result).toEqual({
		linkPath: 'path/to/note.md',
		vaultName: 'my-vault',
	})
})

it('returns undefined for non-obsidian URLs in parseObsidianVaultLink', () => {
	expect(parseObsidianVaultLink('https://example.com')).toBeUndefined()
	expect(parseObsidianVaultLink('not a url')).toBeUndefined()
})

it('returns undefined for obsidian URLs without vault or file params', () => {
	const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()

	expect(parseObsidianVaultLink('obsidian://open')).toBeUndefined()
	expect(parseObsidianVaultLink('obsidian://open?vault=test')).toBeUndefined()
	expect(parseObsidianVaultLink('obsidian://open?file=test')).toBeUndefined()

	spyWarn.mockRestore()
})

it('returns undefined for non-open obsidian URLs', () => {
	expect(parseObsidianVaultLink('obsidian://settings?vault=test&file=note')).toBeUndefined()
})

function allCorrect(testPaths: string[], resolvedTestPaths: string[], test: string) {
	if (testPaths.length !== resolvedTestPaths.length) {
		console.error(`Length mismatch: ${testPaths.length} !== ${resolvedTestPaths.length}`)
		return false
	}

	let allResolvedCorrectly = true
	for (const [i, resolvedTestPath] of resolvedTestPaths.entries()) {
		if (resolvedTestPath === test) {
			continue
		}

		allResolvedCorrectly = false
		console.error(`Error resolving: ${testPaths[i]} --> ${resolvedTestPath}`)
	}

	return allResolvedCorrectly
}

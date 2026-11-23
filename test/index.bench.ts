import { globby } from 'globby'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, vi } from 'vitest'
import { loadLocalNotes } from '../src/lib/actions/load-local-notes'
import { renameFiles } from '../src/lib/actions/rename'
import { getNoteFromMarkdown } from '../src/lib/parse/parse'
import { benchTest } from './utilities/bench-test'

const ASSETS_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'assets')

const FIXTURE_PATHS = {
	basic: 'test-minimal-notes/basic.md',
	cloze: 'test-minimal-notes/cloze.md',
	gfmTables: 'test-fancy-markdown/gfm-tables.md',
	ghAdmonitions: 'test-fancy-markdown/gh-admonitions.md',
	longFrontmatter: 'test-long-frontmatter/long-frontmatter-note.md',
	mathjaxInline: 'test-fancy-markdown/mathjax-inline.md',
	multiCloze: 'test-cloze-multiple/multi-cloze.md',
	syntaxHighlight: 'test-fancy-markdown/syntax-highlighting.md',
	typeInTheAnswer: 'test-minimal-notes/basic-type-in-the-answer.md',
	wikiLinks: 'test-fancy-markdown/obsidian-wiki-links.md',
} as const

type FixtureName = keyof typeof FIXTURE_PATHS

const fixtureNames = Object.keys(FIXTURE_PATHS) as FixtureName[]

const FIXTURE_MARKDOWN = new Map<FixtureName, string>(
	await Promise.all(
		fixtureNames.map(
			async (name) =>
				[
					name,
					await fs.readFile(path.join(ASSETS_DIRECTORY, FIXTURE_PATHS[name]), 'utf8'),
				] as const,
		),
	),
)

const MINIMAL_NOTES_DIRECTORY = path.join(ASSETS_DIRECTORY, 'test-minimal-notes')
const minimalNotesFilePaths = await globby('**/*.md', {
	absolute: true,
	cwd: MINIMAL_NOTES_DIRECTORY,
})
minimalNotesFilePaths.sort()
const MINIMAL_NOTES_FILE_PATHS = minimalNotesFilePaths

// Mirror the optimization at src/lib/actions/load-local-notes.ts that bypasses
// per-call namespace validation, and disable network-bound side effects.
const INTERNAL_OPTIONS = {
	namespaceValidationAndSanitization: false,
	resolveUrls: false,
	syncMediaAssets: 'off',
} as const

// Scale corpus: per-index suffix keeps each markdown unique so caching/string
// interning can't make the bench artificially fast.
const LARGE_CORPUS_SIZE = 10_000
const LARGE_CORPUS_MARKDOWN: readonly string[] = Array.from(
	{ length: LARGE_CORPUS_SIZE },
	(_, index) => `Front of card ${index}\n\n---\n\nBack of card ${index}\n`,
)

// Measures what a fresh process pays before its first note. Steady-state
// benches further down don't surface these first-call costs, so
// `vi.resetModules` makes every iteration evaluate the parser modules again,
// including the syntax highlighter they build at load time. Zero warmup and a
// small sample count keep every sample a cold call.
const COLD_START_PLAIN_MARKDOWN = 'Plain front\n\n---\n\nPlain back with no code at all.'

describe('Tier 1 — public API (cold start)', () => {
	benchTest(
		'getNoteFromMarkdown :: cold start, no code',
		async () => {
			vi.resetModules()
			const { getNoteFromMarkdown: fresh } = await import('../src/lib/parse/parse')
			await fresh(COLD_START_PLAIN_MARKDOWN, INTERNAL_OPTIONS)
		},
		{ iterations: 10, time: 0, warmupIterations: 0, warmupTime: 0 },
	)
})

describe('Tier 1 — public API (in-memory)', () => {
	for (const [name, markdown] of FIXTURE_MARKDOWN) {
		benchTest(`getNoteFromMarkdown :: ${name}`, async () => {
			await getNoteFromMarkdown(markdown, INTERNAL_OPTIONS)
		})
	}
})

describe('Tier 1 — public API (scale)', () => {
	// At 10k notes a single iteration takes tens of seconds; bound the total
	// wall time rather than chasing many samples. Catches regressions of the
	// PR #14 class (parser overhead amplified by N).
	benchTest(
		`getNoteFromMarkdown :: ${LARGE_CORPUS_SIZE} basic notes`,
		async () => {
			for (const markdown of LARGE_CORPUS_MARKDOWN) {
				await getNoteFromMarkdown(markdown, INTERNAL_OPTIONS)
			}
		},
		{ iterations: 2, time: 20_000 },
	)
})

describe('Tier 1 — public API (disk I/O)', () => {
	benchTest('loadLocalNotes :: test-minimal-notes', async () => {
		await loadLocalNotes([...MINIMAL_NOTES_FILE_PATHS], { syncMediaAssets: 'off' })
	})

	benchTest('renameFiles dryRun :: test-minimal-notes', async () => {
		await renameFiles([...MINIMAL_NOTES_FILE_PATHS], {
			dryRun: true,
			manageFilenames: 'response',
			syncMediaAssets: 'off',
		})
	})
})

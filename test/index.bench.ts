import { globby } from 'globby'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bench, describe, vi } from 'vitest'
import { loadLocalNotes } from '../src/lib/actions/load-local-notes'
import { renameFiles } from '../src/lib/actions/rename'
import { getNoteFromMarkdown } from '../src/lib/parse/parse'

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

// Must run BEFORE any other bench in this file so Shiki's process-global
// singleton highlighter is genuinely cold on the first iteration. Steady-state
// benches further down don't surface first-call init costs (theme/grammar
// loading); even `vi.resetModules` can't reset Shiki's singleton, so only
// iteration #1 is truly cold. Small sample count + zero warmup so the cold
// call dominates `max` (and meaningfully shifts `mean`) instead of being
// averaged out across hundreds of warm samples.
//
// Compare `max` across runs: pre-optimization the first iteration pays full
// Shiki init (~2s); when a future change skips Shiki for code-free notes it
// should drop to AST-only cost (tens of ms).
const COLD_START_PLAIN_MARKDOWN = 'Plain front\n\n---\n\nPlain back with no code at all.'

describe('Tier 1 — public API (cold start)', () => {
	bench(
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
		bench(`getNoteFromMarkdown :: ${name}`, async () => {
			await getNoteFromMarkdown(markdown, INTERNAL_OPTIONS)
		})
	}
})

describe('Tier 1 — public API (scale)', () => {
	// At 10k notes a single iteration takes tens of seconds; bound the total
	// wall time rather than chasing many samples. Catches regressions of the
	// PR #14 class (parser overhead amplified by N).
	bench(
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
	bench('loadLocalNotes :: test-minimal-notes', async () => {
		await loadLocalNotes([...MINIMAL_NOTES_FILE_PATHS], { syncMediaAssets: 'off' })
	})

	bench('renameFiles dryRun :: test-minimal-notes', async () => {
		await renameFiles([...MINIMAL_NOTES_FILE_PATHS], {
			dryRun: true,
			manageFilenames: 'response',
			syncMediaAssets: 'off',
		})
	})
})

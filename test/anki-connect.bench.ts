import { globby } from 'globby'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, bench, describe } from 'vitest'
import { YankiConnect } from 'yanki-connect'
import type { YankiNote } from '../src/lib/model/note'
import type { FileAdapter } from '../src/lib/shared/types'
import { loadLocalNotes } from '../src/lib/actions/load-local-notes'
import { syncNotes } from '../src/lib/actions/sync-notes'
import { getDefaultFileAdapter } from '../src/lib/shared/types'
import { addNote, deleteNotes, getRemoteNotes } from '../src/lib/utilities/anki-connect'
import { getSlugifiedNamespace } from '../src/lib/utilities/namespace'
import { loadTestProfile } from './utilities/anki-connect'
import { TEST_PROFILE_NAME } from './utilities/test-constants'

const ASSETS_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'assets')
const MINIMAL_NOTES_DIRECTORY = path.join(ASSETS_DIRECTORY, 'test-minimal-notes')
const MEDIA_NOTES_DIRECTORY = path.join(ASSETS_DIRECTORY, 'test-media')
const BENCH_NAMESPACE = 'Yanki Bench'
const BENCH_NAMESPACE_SLUG = getSlugifiedNamespace(BENCH_NAMESPACE)
const MANY_DECKS_NAMESPACE = 'Yanki Bench Many Decks'
// One note per deck. Sized to make the O(N) sequential `getDeckConfig` cost in
// `getRemoteNotesById` visibly dominate the warm sync. With localhost
// AnkiConnect round trips of a few ms each, ~100 decks puts the deck-config
// loop in the hundreds of ms — a future change that batches via `multi()` (or
// drops the call entirely when no deck is filtered) should drop this dramatically.
const MANY_DECKS_COUNT = 100

// Each bench iteration touches Anki over HTTP and is comparatively slow.
// Keep enough samples for a stable comparison without dragging the suite out.
const BENCH_OPTIONS = { iterations: 3, time: 5000 } as const

const client = new YankiConnect({ autoLaunch: false })
let fileAdapter: FileAdapter

let coldNotes: YankiNote[] = []
let warmNotes: YankiNote[] = []
let coldMediaNotes: YankiNote[] = []
let manyDecksWarmNotes: YankiNote[] = []

async function clearBenchNamespace(): Promise<void> {
	const remote = await getRemoteNotes(client, BENCH_NAMESPACE)
	if (remote.length > 0) {
		await deleteNotes(client, remote, false)
	}
}

async function clearManyDecksNamespace(): Promise<void> {
	const remote = await getRemoteNotes(client, MANY_DECKS_NAMESPACE)
	if (remote.length > 0) {
		await deleteNotes(client, remote, false)
	}
}

async function clearBenchNamespaceMedia(): Promise<void> {
	const filenames = await client.media.getMediaFilesNames({
		pattern: `${BENCH_NAMESPACE_SLUG}-*`,
	})
	for (const filename of filenames) {
		await client.media.deleteMediaFile({ filename })
	}
}

beforeAll(async () => {
	await loadTestProfile(client, TEST_PROFILE_NAME)
	fileAdapter = await getDefaultFileAdapter()

	const filePaths = await globby('**/*.md', {
		absolute: true,
		cwd: MINIMAL_NOTES_DIRECTORY,
	})
	filePaths.sort()

	const localNotes = await loadLocalNotes(filePaths, {
		namespace: BENCH_NAMESPACE,
		syncMediaAssets: 'off',
	})

	coldNotes = localNotes.map(({ note }) => ({ ...note, noteId: undefined }))

	// Warm setup: clear any leftover state, then run a single full sync so
	// decks/models exist and warmNotes carry valid noteIds. The warm bench
	// re-runs syncNotes against this already-synced set.
	await clearBenchNamespace()
	const warmResult = await syncNotes(
		coldNotes.map((note) => ({ ...note })),
		{ namespace: BENCH_NAMESPACE },
	)
	warmNotes = warmResult.synced.map((entry) => entry.note)

	// Media-rich corpus: ~50 unique local media files referenced across the
	// test-media markdown notes. With chunk size 25 in multi(), this spans
	// multiple batches and exercises both the upload and reconcile paths.
	const mediaFilePaths = await globby('**/*.md', {
		absolute: true,
		cwd: MEDIA_NOTES_DIRECTORY,
	})
	mediaFilePaths.sort()

	const localMediaNotes = await loadLocalNotes(mediaFilePaths, {
		fileAdapter,
		namespace: BENCH_NAMESPACE,
		syncMediaAssets: 'local',
	})

	coldMediaNotes = localMediaNotes.map(({ note }) => ({ ...note, noteId: undefined }))

	// Many-decks corpus: one note per deck, all under a dedicated namespace so it
	// doesn't pollute other benches. Initial sync creates the decks and notes;
	// subsequent bench iterations re-sync the same set unchanged, exercising the
	// `getRemoteNotesById` path that fans out one `getDeckConfig` call per
	// unique deck.
	await clearManyDecksNamespace()
	const manyDecksColdNotes: YankiNote[] = Array.from({ length: MANY_DECKS_COUNT }, (_, index) => ({
		deckName: `${MANY_DECKS_NAMESPACE}::Deck ${String(index).padStart(3, '0')}`,
		fields: {
			Back: `Back of card ${index}`,
			Front: `Front of card ${index}`,
			YankiNamespace: MANY_DECKS_NAMESPACE,
		},
		modelName: 'Yanki - Basic',
		noteId: undefined,
		tags: [],
	}))
	const manyDecksResult = await syncNotes(manyDecksColdNotes, {
		namespace: MANY_DECKS_NAMESPACE,
	})
	manyDecksWarmNotes = manyDecksResult.synced.map((entry) => entry.note)
}, 120_000)

afterAll(async () => {
	await clearBenchNamespace()
	await clearBenchNamespaceMedia()
	await clearManyDecksNamespace()
}, 60_000)

describe('Tier 4 — syncNotes (cold)', () => {
	bench(
		'syncNotes :: new notes (clean state per iteration)',
		async () => {
			await clearBenchNamespace()
			await syncNotes(
				coldNotes.map((note) => ({ ...note, noteId: undefined })),
				{ namespace: BENCH_NAMESPACE },
			)
		},
		BENCH_OPTIONS,
	)
})

describe('Tier 4 — syncNotes (warm/unchanged)', () => {
	bench(
		'syncNotes :: unchanged notes',
		async () => {
			await syncNotes(warmNotes, { namespace: BENCH_NAMESPACE })
		},
		BENCH_OPTIONS,
	)
})

describe('Tier 4 — syncNotes (mixed)', () => {
	// Each iteration: clear, batch-create 19 baseline notes, then run a syncNotes
	// pass against an input that mixes 10 modified + 9 unchanged + 10 brand-new
	// notes. Setup is ~150 ms per iteration (constant), included in the timing.
	bench(
		'syncNotes :: 10 new + 10 updated + 9 unchanged',
		async () => {
			await clearBenchNamespace()

			const baseline = coldNotes.slice(0, 19)
			const ids = await client.note.addNotes({
				notes: baseline.map((note) => ({
					deckName: note.deckName,
					fields: note.fields,
					modelName: note.modelName,
					options: { allowDuplicate: true },
					tags: note.tags,
				})),
			})
			if (ids === null) {
				throw new Error('Mixed bench setup: addNotes returned null for the batch')
			}

			const mixedInput: YankiNote[] = [
				// First 10 baseline notes — content modified to force an update.
				...baseline.slice(0, 10).map((note, i) => {
					const id = ids[i]
					if (id === null) {
						throw new Error(`Mixed bench setup: missing noteId at index ${i}`)
					}

					return {
						...note,
						fields: { ...note.fields, Front: `${note.fields.Front} (mixed-bench-updated)` },
						noteId: Number(id),
					}
				}),
				// Next 9 baseline notes — unchanged content, valid noteIds.
				...baseline.slice(10, 19).map((note, i) => {
					const id = ids[10 + i]
					if (id === null) {
						throw new Error(`Mixed bench setup: missing noteId at index ${10 + i}`)
					}

					return { ...note, noteId: Number(id) }
				}),
				// Last 10 cold notes — never created in this iteration, so syncNotes
				// will treat them as new.
				...coldNotes.slice(19, 29).map((note) => ({ ...note, noteId: undefined })),
			]

			await syncNotes(mixedInput, { namespace: BENCH_NAMESPACE })
		},
		BENCH_OPTIONS,
	)
})

describe('Tier 4 — addNote batching probe', () => {
	bench(
		'addNote :: sequential await loop',
		async () => {
			await clearBenchNamespace()
			for (const note of coldNotes) {
				await addNote(client, { ...note, noteId: undefined }, false)
			}
		},
		BENCH_OPTIONS,
	)

	bench(
		'addNote :: Promise.all (concurrent)',
		async () => {
			await clearBenchNamespace()
			await Promise.all(
				coldNotes.map(async (note) => addNote(client, { ...note, noteId: undefined }, false)),
			)
		},
		BENCH_OPTIONS,
	)

	bench(
		'client.note.addNotes :: single batched call',
		async () => {
			await clearBenchNamespace()
			await client.note.addNotes({
				notes: coldNotes.map((note) => ({
					deckName: note.deckName,
					fields: note.fields,
					modelName: note.modelName,
					options: { allowDuplicate: true },
					tags: note.tags,
				})),
			})
		},
		BENCH_OPTIONS,
	)
})

describe('Tier 4 — syncNotes (many decks)', () => {
	// `getRemoteNotesById` calls `client.deck.getDeckConfig` sequentially for
	// every unique deck name returned by `notesInfo`. With ~100 decks each
	// localhost round trip adds up; a future change that batches via `multi()`
	// or skips the call when no deck is filtered should drop this dramatically.
	bench(
		`syncNotes :: ${MANY_DECKS_COUNT} unchanged notes across ${MANY_DECKS_COUNT} decks`,
		async () => {
			await syncNotes(manyDecksWarmNotes, { namespace: MANY_DECKS_NAMESPACE })
		},
		BENCH_OPTIONS,
	)

	// Narrow probe on the bottlenecked function. Isolates the deck-config loop
	// from the rest of syncNotes so the signal is sharper.
	bench(
		`getRemoteNotes :: ${MANY_DECKS_COUNT} notes across ${MANY_DECKS_COUNT} decks`,
		async () => {
			await getRemoteNotes(client, MANY_DECKS_NAMESPACE)
		},
		BENCH_OPTIONS,
	)
})

describe('Tier 4 — syncNotes (media batching)', () => {
	// Cold media sync: every note is brand new and every referenced media file
	// must be uploaded. Targets the in-line per-note upload path that the
	// batched `multi()` flow consolidates, plus the parallel `Promise.all`
	// buffer reads. With ~50 unique media references this also crosses the
	// chunk-of-25 boundary in the new batched implementation.
	bench(
		'syncNotes :: cold sync uploads all media',
		async () => {
			await clearBenchNamespace()
			await clearBenchNamespaceMedia()
			await syncNotes(
				coldMediaNotes.map((note) => ({ ...note, noteId: undefined })),
				{
					fileAdapter,
					namespace: BENCH_NAMESPACE,
				},
			)
		},
		BENCH_OPTIONS,
	)

	// Recovery sync: notes are already present and unchanged, but every media
	// file is missing in Anki. Exercises the `reconcileMedia` recovery path —
	// one `getMediaFilesNames` lookup, then chunked `multi()` `storeMediaFile`
	// requests. Because no notes are freshly written this iteration, the new
	// `freshWriteNoteIds` filter should leave every restored file in the
	// returned `reuploadedMedia`.
	bench(
		'syncNotes :: recovery re-uploads missing media',
		async () => {
			await clearBenchNamespace()
			await clearBenchNamespaceMedia()
			const seeded = await syncNotes(
				coldMediaNotes.map((note) => ({ ...note, noteId: undefined })),
				{
					fileAdapter,
					namespace: BENCH_NAMESPACE,
				},
			)
			await clearBenchNamespaceMedia()
			const seededNotes = seeded.synced.map((entry) => entry.note)
			await syncNotes(seededNotes, {
				fileAdapter,
				namespace: BENCH_NAMESPACE,
			})
		},
		BENCH_OPTIONS,
	)
})

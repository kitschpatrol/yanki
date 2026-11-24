import { globby } from 'globby'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe } from 'vitest'
import { YankiConnect } from 'yanki-connect'
import type { YankiNote } from '../src/lib/model/note'
import type { FileAdapter } from '../src/lib/shared/types'
import { loadLocalNotes } from '../src/lib/actions/load-local-notes'
import { syncNotes } from '../src/lib/actions/sync-notes'
import { getDefaultFileAdapter } from '../src/lib/shared/types'
import { addNote, deleteNotes, getRemoteNotes } from '../src/lib/utilities/anki-connect'
import { getSlugifiedNamespace } from '../src/lib/utilities/namespace'
import { loadTestProfile } from './utilities/anki-connect'
import { benchTest } from './utilities/bench-test'
import { TEST_PROFILE_NAME } from './utilities/test-constants'

const ASSETS_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'assets')
const MINIMAL_NOTES_DIRECTORY = path.join(ASSETS_DIRECTORY, 'test-minimal-notes')
const MEDIA_NOTES_DIRECTORY = path.join(ASSETS_DIRECTORY, 'test-media')
const BENCH_NAMESPACE = 'Yanki Bench'
const BENCH_NAMESPACE_SLUG = getSlugifiedNamespace(BENCH_NAMESPACE)
const MANY_DECKS_NAMESPACE = 'Yanki Bench Many Decks'
// One note per deck. Sized so any per-deck request in `getRemoteNotesById`
// visibly dominates the warm sync: with localhost AnkiConnect round trips of
// a few ms each, ~100 sequential requests add up to hundreds of ms.
const MANY_DECKS_COUNT = 100
const DECK_CHURN_NAMESPACE = 'Yanki Bench Deck Churn'
// One note per deck. Sized so that a request per deck, at tens of milliseconds
// each, dominates the handful of requests the rest of a sync needs.
const DECK_CHURN_COUNT = 50
const LARGE_NAMESPACE = 'Yanki Bench Large'
// Sized so that any bookkeeping in `syncNotes` that scans every note once per
// note takes longer than the requests of an unchanged sync.
const LARGE_NOTE_COUNT = 5000
// Notes are seeded directly through AnkiConnect, a batch at a time, to keep each
// request short
const LARGE_SEED_BATCH_SIZE = 1000

// Each bench iteration touches Anki over HTTP and is comparatively slow.
// Keep enough samples for a stable comparison without dragging the suite out.
const BENCH_OPTIONS = { iterations: 3, time: 5000 } as const

const client = new YankiConnect({ autoLaunch: false })
let fileAdapter: FileAdapter

let coldNotes: YankiNote[] = []
let warmNotes: YankiNote[] = []
let coldMediaNotes: YankiNote[] = []
let manyDecksWarmNotes: YankiNote[] = []

async function clearNamespace(namespace: string): Promise<void> {
	const remote = await getRemoteNotes(client, namespace)
	if (remote.length > 0) {
		await deleteNotes(client, remote, false)
	}
}

async function clearBenchNamespace(): Promise<void> {
	await clearNamespace(BENCH_NAMESPACE)
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
	// test-media markdown notes, exercising both the upload and reconcile paths.
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
	// deck resolution in `getRemoteNotesById` across many unique decks.
	await clearNamespace(MANY_DECKS_NAMESPACE)
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
	await clearNamespace(MANY_DECKS_NAMESPACE)
}, 60_000)

describe('Tier 4 — syncNotes (cold)', () => {
	benchTest(
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
	benchTest(
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
	benchTest(
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
			const mixedInput: YankiNote[] = [
				// First 10 baseline notes — content modified to force an update.
				...baseline.slice(0, 10).map((note, i) => {
					const id = ids[i]
					if (id === undefined) {
						throw new Error(`Mixed bench setup: missing noteId at index ${i}`)
					}

					return {
						...note,
						fields: { ...note.fields, Front: `${note.fields.Front} (mixed-bench-updated)` },
						noteId: id,
					}
				}),
				// Next 9 baseline notes — unchanged content, valid noteIds.
				...baseline.slice(10, 19).map((note, i) => {
					const id = ids[10 + i]
					if (id === undefined) {
						throw new Error(`Mixed bench setup: missing noteId at index ${10 + i}`)
					}

					return { ...note, noteId: id }
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
	benchTest(
		'addNote :: sequential await loop',
		async () => {
			await clearBenchNamespace()
			for (const note of coldNotes) {
				await addNote(client, { ...note, noteId: undefined }, false)
			}
		},
		BENCH_OPTIONS,
	)

	benchTest(
		'addNote :: Promise.all (concurrent)',
		async () => {
			await clearBenchNamespace()
			await Promise.all(
				coldNotes.map(async (note) => addNote(client, { ...note, noteId: undefined }, false)),
			)
		},
		BENCH_OPTIONS,
	)

	benchTest(
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
	// Guards against `getRemoteNotesById` regressing to one request per unique
	// deck name returned by `notesInfo`. With ~100 decks each localhost round
	// trip adds up.
	benchTest(
		`syncNotes :: ${MANY_DECKS_COUNT} unchanged notes across ${MANY_DECKS_COUNT} decks`,
		async () => {
			await syncNotes(manyDecksWarmNotes, { namespace: MANY_DECKS_NAMESPACE })
		},
		BENCH_OPTIONS,
	)

	// Narrow probe on the function that resolves decks. Isolates it from the
	// rest of syncNotes so the signal is sharper.
	benchTest(
		`getRemoteNotes :: ${MANY_DECKS_COUNT} notes across ${MANY_DECKS_COUNT} decks`,
		async () => {
			await getRemoteNotes(client, MANY_DECKS_NAMESPACE)
		},
		BENCH_OPTIONS,
	)
})

describe('Tier 4 — syncNotes (media batching)', () => {
	// Cold media sync: every note is brand new and every referenced media file
	// must be read from disk and uploaded.
	benchTest(
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
	// file is missing in Anki. Exercises the `reconcileMedia` recovery path,
	// which has to find and re-upload every missing file.
	benchTest(
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

describe('Tier 4 — syncNotes (deck churn)', () => {
	const deckChurnNotes: YankiNote[] = Array.from({ length: DECK_CHURN_COUNT }, (_, index) => ({
		deckName: `${DECK_CHURN_NAMESPACE}::Deck ${String(index).padStart(3, '0')}`,
		fields: {
			Back: `Back of card ${index}`,
			Front: `Front of card ${index}`,
			YankiNamespace: DECK_CHURN_NAMESPACE,
		},
		modelName: 'Yanki - Basic',
		noteId: undefined,
		tags: [],
	}))

	// Leaves nothing behind if a run is interrupted between the two syncs
	afterAll(async () => {
		await syncNotes([], { namespace: DECK_CHURN_NAMESPACE })
	}, 120_000)

	// Every iteration creates a deck for each note, then removes the notes and
	// the decks they leave empty. Guards against sending a request per deck when
	// creating missing decks, or when checking which orphaned decks are empty.
	benchTest(
		`syncNotes :: create then remove ${DECK_CHURN_COUNT} notes across ${DECK_CHURN_COUNT} decks`,
		async () => {
			await syncNotes(deckChurnNotes, { namespace: DECK_CHURN_NAMESPACE })
			await syncNotes([], { namespace: DECK_CHURN_NAMESPACE })
		},
		BENCH_OPTIONS,
	)
})

// Kept last, with its notes seeded and removed inside the suite: every sync
// loads the Yanki notes of all namespaces, so these would slow the other
// benchmarks down while they exist.
describe('Tier 4 — syncNotes (large collection)', () => {
	let largeWarmNotes: YankiNote[] = []

	beforeAll(async () => {
		await clearNamespace(LARGE_NAMESPACE)
		await client.deck.createDeck({ deck: LARGE_NAMESPACE })

		const largeNotes: YankiNote[] = Array.from({ length: LARGE_NOTE_COUNT }, (_, index) => ({
			deckName: LARGE_NAMESPACE,
			fields: {
				Back: `Back of card ${index}`,
				Front: `Front of card ${index}`,
				YankiNamespace: LARGE_NAMESPACE,
			},
			modelName: 'Yanki - Basic',
			noteId: undefined,
			tags: [],
		}))

		const noteIds: number[] = []
		for (let start = 0; start < largeNotes.length; start += LARGE_SEED_BATCH_SIZE) {
			const batchNoteIds = await client.note.addNotes({
				notes: largeNotes.slice(start, start + LARGE_SEED_BATCH_SIZE).map((note) => ({
					deckName: note.deckName,
					fields: note.fields,
					modelName: note.modelName,
					options: { allowDuplicate: true },
					tags: note.tags,
				})),
			})
			noteIds.push(...batchNoteIds)
		}

		largeWarmNotes = largeNotes.map((note, index) => {
			const noteId = noteIds[index]
			if (noteId === undefined) {
				throw new Error(`Large collection bench setup: missing noteId at index ${index}`)
			}

			return { ...note, noteId }
		})
	}, 300_000)

	afterAll(async () => {
		await clearNamespace(LARGE_NAMESPACE)
		await client.deck.deleteDecks({ cardsToo: true, decks: [LARGE_NAMESPACE] })
	}, 300_000)

	// An unchanged sync of a large collection, where the requests are few and
	// the time goes to loading the notes and matching them up locally.
	benchTest(
		`syncNotes :: ${LARGE_NOTE_COUNT} unchanged notes`,
		async () => {
			await syncNotes(largeWarmNotes, { namespace: LARGE_NAMESPACE })
		},
		BENCH_OPTIONS,
	)
})

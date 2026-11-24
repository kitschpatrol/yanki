import { describe, expect, it, vi } from 'vitest'
import type { SyncFilesResult } from '../src/lib'
import type { YankiNote } from '../src/lib/model/note'
import type { FetchAdapter } from '../src/lib/shared/types'
import { cleanNotes, formatSyncFilesResult, syncNotes } from '../src/lib'

type FakeNote = {
	deckName: string
	fields: Record<string, string>
	modelName: string
	noteId: number
	tags: string[]
}

type FakeRequest = { action: string; key?: string; params?: Record<string, unknown> }

type FakeAnkiOptions = {
	/**
	 * Key every request and nested action must carry, as in AnkiConnect's
	 * `apiKey` setting
	 */
	apiKey?: string
	/** HTTP status returned for any request that uploads media */
	mediaUploadStatus?: number
	/** Media files that fail to delete */
	undeletableMedia?: string[]
}

/**
 * An in-memory stand-in for the parts of AnkiConnect a sync uses, reachable
 * through the client's fetch adapter. Every note has a single card, numbered
 * after its note.
 */
class FakeAnki {
	/** Deck IDs by deck name */
	readonly decks = new Map<string, number>()
	readonly media = new Set<string>()
	readonly models = new Set<string>()
	readonly notes = new Map<number, FakeNote>()
	readonly requests: FakeRequest[] = []
	/**
	 * One entry per request received. A `multi` request lists the distinct
	 * actions nested in it, as in `multi(getDecks, findCards)`.
	 */
	get requestNames(): string[] {
		return this.requests.map((request) => {
			if (request.action !== 'multi') {
				return request.action
			}

			const nestedNames = (request.params?.actions as FakeRequest[]).map((nested) => nested.action)
			return `multi(${[...new Set(nestedNames)].join(', ')})`
		})
	}
	private nextNoteId = 1000

	private readonly options: FakeAnkiOptions

	constructor(options: FakeAnkiOptions = {}) {
		this.options = options
	}

	addDeck(deckName: string): number {
		const deckId = this.decks.get(deckName) ?? this.decks.size + 1
		this.decks.set(deckName, deckId)
		return deckId
	}

	addNote(note: FakeNote): void {
		this.notes.set(note.noteId, note)
		this.addDeck(note.deckName)
		this.models.add(note.modelName)
	}

	readonly fetchAdapter: FetchAdapter = async (_url, init) => {
		await Promise.resolve()
		const request = JSON.parse(init?.body ?? '{}') as FakeRequest
		this.requests.push(request)

		const isMediaUpload = JSON.stringify(request).includes('"storeMediaFile"')
		return {
			headers: {},
			json: vi.fn().mockResolvedValue(this.reply(request)),
			status: isMediaUpload ? (this.options.mediaUploadStatus ?? 200) : 200,
		}
	}

	private reply(request: FakeRequest): { error: string | undefined; result: unknown } {
		try {
			const isKeyValid = this.options.apiKey === undefined || request.key === this.options.apiKey
			if (!isKeyValid && request.action !== 'requestPermission') {
				throw new Error('valid api key must be provided')
			}

			// eslint-disable-next-line unicorn/no-null
			return { error: null as unknown as undefined, result: this.run(request) }
		} catch (error) {
			// eslint-disable-next-line unicorn/no-null
			return { error: error instanceof Error ? error.message : String(error), result: null }
		}
	}

	// eslint-disable-next-line complexity
	private run({ action, params = {} }: FakeRequest): unknown {
		switch (action) {
			case 'addNotes': {
				type NewNote = Omit<FakeNote, 'noteId' | 'tags'> & { tags?: string[] }
				return (params.notes as NewNote[]).map((note) => {
					const noteId = this.nextNoteId++
					this.addNote({ ...note, noteId, tags: note.tags ?? [] })
					return noteId
				})
			}

			case 'cardsInfo': {
				return []
			}

			case 'createDeck': {
				return this.addDeck(params.deck as string)
			}

			case 'createModel': {
				this.models.add(params.modelName as string)
				return {}
			}

			case 'deckNames': {
				return this.decks.keys().toArray()
			}

			case 'deckNamesAndIds': {
				return Object.fromEntries(this.decks)
			}

			case 'deleteDecks': {
				for (const deckName of params.decks as string[]) {
					this.decks.delete(deckName)
				}

				// eslint-disable-next-line unicorn/no-null
				return null
			}

			case 'deleteMediaFile': {
				const filename = params.filename as string
				if (this.options.undeletableMedia?.includes(filename)) {
					throw new Error('file is locked')
				}

				this.media.delete(filename)
				// eslint-disable-next-line unicorn/no-null
				return null
			}

			case 'deleteNotes': {
				for (const noteId of params.notes as number[]) {
					this.notes.delete(noteId)
				}

				// eslint-disable-next-line unicorn/no-null
				return null
			}

			case 'findCards': {
				// No deck is ever filtered, and every other search is for the cards
				// of decks by ID
				const query = params.query as string
				const deckIds = new Set(query.matchAll(/did:(\d+)/gv).map(([, deckId]) => Number(deckId)))
				return this.notes
					.values()
					.filter((note) => deckIds.has(this.decks.get(note.deckName) ?? 0))
					.map((note) => note.noteId)
					.toArray()
			}

			case 'findNotes': {
				return this.notes.keys().toArray()
			}

			case 'getDecks': {
				const cardsByDeck: Record<string, number[]> = {}
				for (const cardId of params.cards as number[]) {
					const deckName = this.notes.get(cardId)?.deckName
					if (deckName !== undefined) {
						cardsByDeck[deckName] = [...(cardsByDeck[deckName] ?? []), cardId]
					}
				}

				return cardsByDeck
			}

			case 'getMediaFilesNames': {
				return [...this.media]
			}

			case 'modelNames': {
				return [...this.models]
			}

			case 'multi': {
				return (params.actions as FakeRequest[]).map((nested) => this.reply(nested))
			}

			case 'notesInfo': {
				return (params.notes as number[]).map((noteId) => {
					const note = this.notes.get(noteId)
					if (note === undefined) {
						return {}
					}

					return {
						cards: [noteId],
						fields: Object.fromEntries(
							Object.entries(note.fields).map(([name, value], order) => [name, { order, value }]),
						),
						modelName: note.modelName,
						noteId,
						tags: note.tags,
					}
				})
			}

			case 'requestPermission': {
				return {
					permission: 'granted',
					requireApiKey: this.options.apiKey !== undefined,
					version: 6,
				}
			}

			case 'storeMediaFile': {
				const filename = params.filename as string
				this.media.add(filename)
				return filename
			}

			case 'updateNoteModel': {
				const update = params.note as Pick<FakeNote, 'fields' | 'modelName' | 'tags'> & {
					id: number
				}
				const note = this.notes.get(update.id)
				if (note === undefined) {
					throw new Error(`note was not found: ${update.id}`)
				}

				this.addNote({
					...note,
					fields: update.fields,
					modelName: update.modelName,
					tags: update.tags,
				})
				// eslint-disable-next-line unicorn/no-null
				return null
			}

			default: {
				throw new Error(`unsupported action: ${action}`)
			}
		}
	}
}

function makeNote(noteId: number | undefined, front: string, back = 'back'): YankiNote {
	return {
		deckName: 'Deck',
		fields: { Back: back, Front: front, YankiNamespace: 'test' },
		modelName: 'Yanki - Basic',
		noteId,
		tags: [],
	}
}

function makeFakeAnki(remoteFronts: Record<number, string>, options?: FakeAnkiOptions): FakeAnki {
	const anki = new FakeAnki(options)
	for (const [noteId, front] of Object.entries(remoteFronts)) {
		anki.addNote({ ...makeNote(Number(noteId), front), noteId: Number(noteId), tags: [] })
	}

	return anki
}

describe('syncNotes against a fake AnkiConnect', () => {
	it('reports each note in input order with the action and ID that belong to it', async () => {
		const anki = makeFakeAnki({ 1: 'unchanged front', 2: 'old front', 3: 'matched front' })

		const { synced } = await syncNotes(
			[
				makeNote(undefined, 'new front'),
				makeNote(1, 'unchanged front'),
				makeNote(2, 'edited front'),
				makeNote(undefined, 'matched front'),
			],
			{
				ankiConnectOptions: { autoLaunch: false, fetchAdapter: anki.fetchAdapter },
				namespace: 'test',
			},
		)

		expect(synced.map(({ action, note }) => [action, note.noteId, note.fields.Front])).toEqual([
			['created', 1000, 'new front'],
			['unchanged', 1, 'unchanged front'],
			['updated', 2, 'edited front'],
			['matched', 3, 'matched front'],
		])
		expect(anki.notes.get(1000)?.fields.Front).toBe('new front')
		expect(anki.notes.get(2)?.fields.Front).toBe('edited front')
		expect(anki.notes.size).toBe(4)
	})

	it('only reads from Anki when every note already matches it', async () => {
		const anki = makeFakeAnki({ 1: 'first front', 2: 'second front' })

		const { synced } = await syncNotes([makeNote(1, 'first front'), makeNote(2, 'second front')], {
			ankiConnectOptions: { autoLaunch: false, fetchAdapter: anki.fetchAdapter },
			namespace: 'test',
		})

		expect(synced.map(({ action }) => action)).toEqual(['unchanged', 'unchanged'])
		// Each request has a fixed cost, so an unchanged sync sends no model and
		// deck probe and no empty deletion
		expect(anki.requestNames).toEqual([
			'requestPermission',
			'findNotes',
			'notesInfo',
			'multi(getDecks, findCards)',
			'getMediaFilesNames',
		])
	})

	it('creates the model and deck a new note needs', async () => {
		const anki = makeFakeAnki({})

		const { synced } = await syncNotes([makeNote(undefined, 'new front')], {
			ankiConnectOptions: { autoLaunch: false, fetchAdapter: anki.fetchAdapter },
			namespace: 'test',
		})

		expect([...anki.models]).toEqual(['Yanki - Basic'])
		expect(anki.decks.keys().toArray()).toEqual(['Deck'])
		expect(synced.map(({ action, note }) => [action, note.noteId])).toEqual([['created', 1000]])
	})

	it('creates and removes any number of decks with one request each', async () => {
		const anki = makeFakeAnki({})
		const deckNames = Array.from({ length: 30 }, (_, index) => `Deck ${index}`)
		const options = {
			ankiConnectOptions: { autoLaunch: false, fetchAdapter: anki.fetchAdapter },
			namespace: 'test',
		}

		await syncNotes(
			deckNames.map((deckName, index) => ({ ...makeNote(undefined, `front ${index}`), deckName })),
			options,
		)

		expect(anki.requestNames).toEqual([
			'requestPermission',
			'findNotes',
			'multi(modelNames, deckNames)',
			'multi(createModel, createDeck)',
			'addNotes',
			'getMediaFilesNames',
		])
		expect(anki.decks.keys().toArray()).toEqual(deckNames)

		anki.requests.length = 0
		const { deletedDecks } = await syncNotes([], options)

		expect(anki.requestNames).toEqual([
			'requestPermission',
			'findNotes',
			'notesInfo',
			'multi(getDecks, findCards)',
			'deleteNotes',
			'deckNamesAndIds',
			'multi(findCards)',
			'deleteDecks',
			'getMediaFilesNames',
		])
		expect(deletedDecks).toEqual(deckNames.toSorted())
		expect(anki.decks.size).toBe(0)
	})

	it('keeps the local note matching Anki when several share its ID, and creates the rest', async () => {
		const anki = makeFakeAnki({ 1: 'original front' })

		const { synced } = await syncNotes(
			[makeNote(1, 'first copy'), makeNote(1, 'original front'), makeNote(1, 'second copy')],
			{
				ankiConnectOptions: { autoLaunch: false, fetchAdapter: anki.fetchAdapter },
				namespace: 'test',
			},
		)

		expect(synced.map(({ action, note }) => [action, note.noteId, note.fields.Front])).toEqual([
			['created', 1000, 'first copy'],
			['unchanged', 1, 'original front'],
			['created', 1001, 'second copy'],
		])
	})

	it('keeps the first local note when several share an ID and none matches Anki', async () => {
		const anki = makeFakeAnki({ 1: 'original front' })

		const { synced } = await syncNotes([makeNote(1, 'first copy'), makeNote(1, 'second copy')], {
			ankiConnectOptions: { autoLaunch: false, fetchAdapter: anki.fetchAdapter },
			namespace: 'test',
		})

		expect(synced.map(({ action, note }) => [action, note.noteId, note.fields.Front])).toEqual([
			['updated', 1, 'first copy'],
			['created', 1000, 'second copy'],
		])
	})

	it('does not content-match a note onto an ID that a later local note already holds', async () => {
		const anki = makeFakeAnki({ 1: 'shared front' })

		const { synced } = await syncNotes(
			[makeNote(undefined, 'shared front'), makeNote(1, 'shared front')],
			{
				ankiConnectOptions: { autoLaunch: false, fetchAdapter: anki.fetchAdapter },
				namespace: 'test',
			},
		)

		expect(synced.map(({ action, note }) => [action, note.noteId])).toEqual([
			['created', 1000],
			['unchanged', 1],
		])
	})

	it('deletes notes that are only in Anki and leaves other namespaces alone', async () => {
		const anki = makeFakeAnki({ 1: 'kept front', 2: 'orphaned front', 3: 'another orphan' })
		anki.addNote({
			...makeNote(7, 'front in another namespace'),
			fields: { Back: 'back', Front: 'front in another namespace', YankiNamespace: 'other' },
			noteId: 7,
			tags: [],
		})

		// The last local note carries the ID of the note in the other namespace
		const { synced } = await syncNotes(
			[makeNote(1, 'kept front'), makeNote(7, 'front with a borrowed ID')],
			{
				ankiConnectOptions: { autoLaunch: false, fetchAdapter: anki.fetchAdapter },
				namespace: 'test',
			},
		)

		expect(synced.map(({ action, note }) => [action, note.noteId])).toEqual([
			['unchanged', 1],
			['created', 1000],
			['deleted', 2],
			['deleted', 3],
		])
		expect(anki.notes.keys().toArray()).toEqual([1, 7, 1000])
	})

	it('checks the cards of notes whose model changed, and only those', async () => {
		const anki = makeFakeAnki({ 1: 'first front', 2: 'second front', 3: 'third front' })

		await syncNotes(
			[
				{ ...makeNote(1, 'first front'), modelName: 'Yanki - Cloze' },
				makeNote(2, 'second front edited'),
				makeNote(3, 'third front'),
			],
			{
				ankiConnectOptions: { autoLaunch: false, fetchAdapter: anki.fetchAdapter },
				namespace: 'test',
			},
		)

		const cardChecks = anki.requests.filter(({ action }) => action === 'cardsInfo')
		expect(cardChecks.map(({ params }) => params)).toEqual([{ cards: [1] }])
	})

	it('syncs through an AnkiConnect that requires an API key', async () => {
		const anki = makeFakeAnki({ 1: 'old front' }, { apiKey: 'secret' })

		const { synced } = await syncNotes([makeNote(1, 'edited front')], {
			ankiConnectOptions: { autoLaunch: false, fetchAdapter: anki.fetchAdapter, key: 'secret' },
			namespace: 'test',
		})

		expect(synced.map(({ action }) => action)).toEqual(['updated'])
		expect(anki.notes.get(1)?.fields.Front).toBe('edited front')
	})

	it('completes the sync and reports the media when an upload request is rejected', async () => {
		const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()
		const anki = makeFakeAnki({}, { mediaUploadStatus: 413 })
		anki.models.add('Yanki - Basic')
		anki.addDeck('Deck')
		const back =
			'<img src="yanki-test-big.png" data-yanki-media-sync="true" data-yanki-media-src="https://example.com/big.png">'

		const { failedReuploadedMedia, synced } = await syncNotes(
			[makeNote(undefined, 'front with media', back)],
			{
				ankiConnectOptions: { autoLaunch: false, fetchAdapter: anki.fetchAdapter },
				namespace: 'test',
			},
		)

		expect(synced.map(({ action, note }) => [action, note.noteId])).toEqual([['created', 1000]])
		expect(failedReuploadedMedia).toEqual([
			{ filename: 'yanki-test-big.png', reason: 'Error: AnkiConnect response status is 413' },
		])
		spyWarn.mockRestore()
	})
})

describe('cleanNotes against a fake AnkiConnect', () => {
	it('throws, naming the files, when media can not be deleted', async () => {
		const spyWarn = vi.spyOn(console, 'warn').mockReturnValue()
		const anki = makeFakeAnki({}, { undeletableMedia: ['yanki-test-stuck.png'] })
		anki.media.add('yanki-test-stuck.png')
		anki.media.add('yanki-test-loose.png')

		await expect(
			cleanNotes({
				ankiConnectOptions: { autoLaunch: false, fetchAdapter: anki.fetchAdapter },
				namespace: 'test',
			}),
		).rejects.toThrow(
			'Could not delete 1 media asset from Anki:\n  yanki-test-stuck.png: file is locked',
		)
		expect([...anki.media]).toEqual(['yanki-test-stuck.png'])
		spyWarn.mockRestore()
	})
})

describe('formatSyncFilesResult', () => {
	const result: SyncFilesResult = {
		ankiWeb: false,
		deletedDecks: [],
		deletedMedia: [],
		dryRun: false,
		duration: 0,
		failedDeletedMedia: [{ filename: 'yanki-test-stuck.png', reason: 'file is locked' }],
		failedReuploadedMedia: [{ filename: 'yanki-test-big.png', reason: 'status is 413' }],
		fixedDatabase: false,
		namespace: 'test',
		reuploadedMedia: [],
		synced: [],
	}

	it('lists media failures in the verbose report', () => {
		const report = formatSyncFilesResult(result, true)

		expect(report).toContain(
			'Media assets that failed to upload: 1\n  yanki-test-big.png: status is 413',
		)
		expect(report).toContain(
			'Media assets that failed to delete: 1\n  yanki-test-stuck.png: file is locked',
		)
	})

	it('leaves media failures out of the one-line report', () => {
		expect(formatSyncFilesResult(result)).not.toContain('failed')
	})
})

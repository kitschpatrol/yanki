import { type ParamsForAction, type ResultForAction } from '../../yanki-connect/dist/types/shared'
import { setNoteIdInFrontmatter } from './parse/ast-utilities'
import { getAnkiJsonFromMarkdown } from './parse/parse'
import {
	type YankiModelName,
	type YankiNote,
	yankiModelNames,
	yankiModels,
} from './types/anki-note'
import fs from 'node:fs/promises'
import { YankiConnect } from 'yanki-connect'

export async function logDefaultAnkiModelTemplates() {
	const client = new YankiConnect()
	// We expect Anki to have these, but it's not guaranteed
	const defaultModelNames = [
		'Basic',
		'Basic (and reversed card)',
		'Cloze',
		'Basic (type in the answer)',
	]

	for (const modelName of defaultModelNames) {
		const model = await client.model.modelTemplates({ modelName })
		console.log(`${modelName} ----------------------------------`)
		console.log(model)
	}
}

async function addNote(client: YankiConnect, note: YankiNote): Promise<number> {
	if (note.noteId !== undefined) {
		throw new Error('Note already has an ID')
	}

	const newNote = await client.note.addNote({ note }).catch(async (error) => {
		if (error instanceof Error) {
			if (error.message === `model was not found: ${note.modelName}`) {
				// Create the model and try again
				const model = yankiModels.find((model) => model.modelName === note.modelName)
				if (model === undefined) {
					throw new Error(`Model not found: ${note.modelName}`)
				}

				await client.model.createModel(model)
				return addNote(client, note)
			}

			if (error.message === `deck was not found: ${note.deckName}`) {
				// Create the deck and try again
				const result = await client.deck.createDeck({ deck: note.deckName })
				console.log('----------------- Deck Created -----------------')
				console.log(result)
				return addNote(client, note)
			}

			if (error.message === 'cannot create note because it is empty') {
				console.log('----------------- Note Empty -----------------')
				console.log(note)
			}

			throw error
		} else {
			throw new TypeError('Unknown error')
		}
	})

	if (newNote === null) {
		throw new Error('Note creation failed')
	}

	return newNote
}

type SyncedNoteFile = {
	filePath: string
} & SyncedNote

async function syncFiles(
	allLocalFilePaths: string[],
): Promise<{ deleted: number[]; synced: SyncedNoteFile[] }> {
	const allLocalMarkdown: string[] = []
	const allLocalNotes: YankiNote[] = []
	for (const filePath of allLocalFilePaths) {
		const markdown = await fs.readFile(filePath, 'utf8')
		allLocalMarkdown.push(markdown)
		allLocalNotes.push(await getAnkiJsonFromMarkdown(markdown))
	}

	const { deleted, synced } = await syncNotes(allLocalNotes)

	// Write IDs to the local files as necessary
	// Can't just get markdown from the note because there might be extra frontmatter from e.g. obsidian
	// TODO write everything for markdown style enforcement?
	// Or write frontmatter without touching? markdown? better?
	for (const [index, note] of allLocalNotes.entries()) {
		const syncedNoteId = synced[index].note.noteId
		if (note.noteId === undefined || note.noteId !== syncedNoteId) {
			note.noteId = syncedNoteId

			if (note.noteId === undefined) {
				throw new Error('Note ID is still undefined')
			}

			const updatedMarkdown = await setNoteIdInFrontmatter(allLocalMarkdown[index], note.noteId)
			await fs.writeFile(allLocalFilePaths[index], updatedMarkdown)
		}
	}

	const syncedFiles: SyncedNoteFile[] = allLocalNotes.map((note, index) => ({
		action: synced[index].action,
		filePath: allLocalFilePaths[index],
		note,
	}))

	return {
		deleted,
		synced: syncedFiles,
	}
}

function areTagsEqual(localTags: string[], remoteTags: string[]): boolean {
	if (localTags.length !== remoteTags.length) return false

	for (const [i, element] of localTags.entries()) {
		if (element !== remoteTags[i]) return false
	}

	return true
}

// No way to get everything we need to populate a YankiNote in one call...
async function getRemoteNotes(
	client: YankiConnect,
	noteIds: number[],
): Promise<Array<YankiNote | undefined>> {
	const ankiNotes = await client.note.notesInfo({ notes: noteIds })
	const yankiNotes: Array<YankiNote | undefined> = []

	if (ankiNotes.every((ankiNote) => ankiNote.noteId === undefined)) {
		// All undefined, return early
		// eslint-disable-next-line unicorn/no-useless-undefined
		return Array.from<undefined>({ length: ankiNotes.length }).fill(undefined)
	}

	// Have to fish decks out of the card IDs
	const allCardIds = ankiNotes.flatMap((note) => note.cards ?? [])
	const deckToCardMap = await client.deck.getDecks({ cards: allCardIds })

	// Map card IDs to deck names for easy lookup
	const cardIdToDeckMap = new Map<number, string>()
	for (const [deck, cards] of Object.entries(deckToCardMap)) {
		for (const card of cards) {
			cardIdToDeckMap.set(card, deck)
		}
	}

	for (const ankiNote of ankiNotes) {
		if (ankiNote.noteId === undefined) {
			yankiNotes.push(undefined)
			continue
		}

		// Get deck name
		const deckSet = new Set<string>()
		for (const card of ankiNote.cards) {
			const deck = cardIdToDeckMap.get(card)
			if (deck === undefined) {
				throw new Error(`No deck found for card ${card}`)
			}

			deckSet.add(deck)
		}

		if (deckSet.size === 0) {
			throw new Error(`No decks found for note ${ankiNote.noteId}`)
		}

		if (deckSet.size > 1) {
			throw new Error(`Multiple decks found for note ${ankiNote.noteId}`)
		}

		if (!yankiModelNames.includes(ankiNote.modelName as YankiModelName)) {
			throw new Error(`Unknown model name ${ankiNote.modelName} for note ${ankiNote.noteId}`)
		}

		// Picture, sound, etc. fields are never provided

		yankiNotes.push({
			cards: ankiNote.cards,
			deckName: [...deckSet][0],
			fields: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				Back: ankiNote.fields.Back.value ?? '',
				// eslint-disable-next-line @typescript-eslint/naming-convention
				Front: ankiNote.fields.Front.value ?? '',
			},
			modelName: ankiNote.modelName as YankiModelName, // Checked above
			noteId: ankiNote.noteId,
			tags: ankiNote.tags,
		})
	}

	return yankiNotes
}

async function updateNote(
	client: YankiConnect,
	localNote: YankiNote,
	remoteNote: YankiNote,
): Promise<boolean> {
	// Check if tags are different
	if (localNote.noteId === undefined) {
		throw new Error('Local note ID is undefined')
	}

	if (remoteNote.cards === undefined) {
		throw new Error('Remote note cards are undefined')
	}

	let updated = false

	if (
		!areTagsEqual(localNote.tags ?? [], remoteNote.tags ?? []) ||
		localNote.fields.Back !== remoteNote.fields.Back ||
		localNote.fields.Front !== remoteNote.fields.Front
	) {
		const updateResult = await client.note.updateNote({
			note: { ...localNote, id: localNote.noteId },
		})
		console.log('----------------- Update result -----------------')
		console.log(updateResult)
		updated = true
	}

	// Check if decks are different
	if (localNote.deckName !== remoteNote.deckName) {
		await client.deck.changeDeck({ cards: remoteNote.cards, deck: localNote.deckName })
		updated = true
	}

	return updated
}

type SyncedNote = { action: 'created' | 'recreated' | 'unchanged' | 'updated'; note: YankiNote }
async function syncNotes(allLocalNotes: YankiNote[]): Promise<{
	deleted: number[]
	synced: SyncedNote[]
}> {
	const synced: SyncedNote[] = []

	const client = new YankiConnect()

	const remoteNoteIds = await client.note.findNotes({ query: 'note:"Yanki - *"' })

	// Deletion pass
	const orphans = remoteNoteIds.filter(
		(note) => !allLocalNotes.some((localNote) => localNote.noteId === note),
	)
	await client.note.deleteNotes({ notes: orphans })

	// Set undefined local note IDs to bogus ones to ensure we create them
	const localNoteIds = allLocalNotes.map((note) => note.noteId).map((id) => id ?? -1)
	const remoteNotes = await getRemoteNotes(client, localNoteIds)

	// Creation and update pass
	for (const [index, remoteNote] of remoteNotes.entries()) {
		const localNote = allLocalNotes[index]

		// Undefined means the note only exists locally
		if (remoteNote === undefined) {
			// Ensure id is undefined, in case the local id is corrupted (e.g. changed by hand)
			const newNoteId = await addNote(client, { ...localNote, noteId: undefined })

			synced.push({
				action: 'created',
				note: {
					...localNote,
					noteId: newNoteId,
				},
			})
		} else if (localNote.modelName === remoteNote.modelName) {
			// Update remote notes if they differ
			const wasUpdated = await updateNote(client, localNote, remoteNote)

			synced.push({
				action: wasUpdated ? 'updated' : 'unchanged',
				note: localNote,
			})
		} else {
			console.log('Model change, need to recreate')

			if (remoteNote.noteId === undefined) {
				throw new Error('Remote note ID is undefined')
			}

			await client.note.deleteNotes({ notes: [remoteNote.noteId] })
			const newNoteId = await addNote(client, { ...localNote, noteId: undefined })

			synced.push({
				action: 'recreated',
				note: {
					...localNote,
					noteId: newNoteId,
				},
			})
		}
	}

	return {
		deleted: orphans,
		synced,
	}
}

const testPaths = [
	// './test/assets/cloze.md',
	'./test/assets/basic.md',
	'./test/assets/basic-and-reversed-card.md',
	// './test/assets/basic-type-in-the-answer.md',
]

const result = await syncFiles(testPaths)

console.log('----------------- Result -----------------')
console.log(result)

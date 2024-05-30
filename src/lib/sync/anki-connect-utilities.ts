import { type YankiNote, getYankiModelNames, getYankiModels } from '../model/yanki-note'
import { type YankiConnect } from 'yanki-connect'

export async function deleteNotes(client: YankiConnect, notes: YankiNote[], dryRun = false) {
	if (dryRun) {
		return
	}

	const noteIds = notes
		.map((note) => note.noteId)
		.filter((noteId) => noteId !== undefined) as number[]

	await client.note.deleteNotes({ notes: noteIds })
}

export async function deleteNote(client: YankiConnect, note: YankiNote, dryRun = false) {
	if (note.noteId === undefined) {
		throw new Error('Note ID is undefined')
	}

	if (dryRun) {
		return
	}

	await client.note.deleteNotes({ notes: [note.noteId] })
}

/**
 * Add a note to Anki.
 *
 * Does "just in time" creation of requisite models and decks.
 *
 * Duplicates will be created. It's up to the user to manage their markdown
 * files as they like.
 *
 * @param client An instance of YankiConnect
 * @param note The note to add @returns The ID of the newly created note in Anki
 * @throws
 */
export async function addNote(
	client: YankiConnect,
	note: YankiNote,
	modelPrefix: string,
	dryRun: boolean,
): Promise<number> {
	if (note.noteId !== undefined) {
		throw new Error('Note already has an ID')
	}

	if (dryRun) {
		return 0
	}

	const newNote = await client.note
		.addNote({
			note: {
				...note,
				options: {
					allowDuplicate: true,
				},
			},
		})
		.catch(async (error) => {
			if (error instanceof Error) {
				if (error.message === `model was not found: ${note.modelName}`) {
					const yankiModels = getYankiModels(modelPrefix)
					// Create the model and try again
					const model = yankiModels.find((model) => model.modelName === note.modelName)
					if (model === undefined) {
						throw new Error(`Model not found: ${note.modelName}`)
					}

					await client.model.createModel(model)
					return addNote(client, note, modelPrefix, dryRun)
				}

				if (error.message === `deck was not found: ${note.deckName}`) {
					// Create the deck and try again

					if (note.deckName === undefined) {
						throw new Error('Deck name is undefined')
					}

					await client.deck.createDeck({ deck: note.deckName })
					return addNote(client, note, modelPrefix, dryRun)
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

/**
 * Updates a note in Anki.
 *
 * In certain circumstances (like a model change), the note will be recreated.
 * This destroys any scheduling information for that note.
 *
 * @param client An instance of YankiConnect
 * @param localNote A note read from a markdown file @param remoteNote A note
 * loaded from Anki @returns True if the note was updated, false otherwise.
 * @throws
 */
export async function updateNote(
	client: YankiConnect,
	localNote: YankiNote,
	remoteNote: YankiNote,
	dryRun: boolean,
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
		if (!dryRun) {
			await client.note.updateNote({
				note: { ...localNote, id: localNote.noteId },
			})
		}

		updated = true
	}

	// Check if decks are different
	if (localNote.deckName !== remoteNote.deckName) {
		if (localNote.deckName === undefined) {
			throw new Error('Local deck name is undefined')
		}

		if (!dryRun) {
			await client.deck.changeDeck({ cards: remoteNote.cards, deck: localNote.deckName })
		}

		updated = true
	}

	return updated
}

/**
 * Helper function to compare two arrays of tags.
 *
 * @param localTags
 * @param remoteTags @returns True if the tags are equal, false otherwise.
 */
function areTagsEqual(localTags: string[], remoteTags: string[]): boolean {
	if (localTags.length !== remoteTags.length) return false

	for (const [i, element] of localTags.entries()) {
		if (element !== remoteTags[i]) return false
	}

	return true
}

/**
 * Get all notes from Anki that match the model prefix.
 *
 * @param client An instance of YankiConnect
 * @param modelPrefix The prefix of the model name to search for
 * @returns An array of YankiNote objects
 * @throws
 */
export async function getRemoteNotes(
	client: YankiConnect,
	modelPrefix: string,
): Promise<YankiNote[]> {
	const noteIds = await client.note.findNotes({ query: `note:"${modelPrefix}*"` })

	// We can trust that these are defined, since the list of notes is coming
	// straight from Anki
	return (await getRemoteNotesById(client, modelPrefix, noteIds)) as YankiNote[]
}

/**
 * Get all data from Anki required to populate the YankiNote type.
 *
 * Handles some extra footwork to identify the deck name and validate the model
 * name. There's no way to get everything we need in one shot from Anki-Connect.
 *
 * Undefined elements in the returned array are subsequently used to identify
 * notes that need to be created.
 *
 * @param client An instance of YankiConnect
 * @param noteIds
 * @param modelPrefix An array of local note IDs to (attempt) to fetch @returns
 * Array of YankiNote objects, with undefined for notes that could not be found.
 * @throws
 */
export async function getRemoteNotesById(
	client: YankiConnect,
	modelPrefix: string,
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

	const yankiModelNames = getYankiModelNames(modelPrefix)
	for (const ankiNote of ankiNotes) {
		// If the model name is changed in Anki, a bunch of notes might end up being created again
		if (ankiNote.noteId === undefined || !yankiModelNames.includes(ankiNote.modelName)) {
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
			modelName: ankiNote.modelName, // Checked above
			noteId: ankiNote.noteId,
			tags: ankiNote.tags,
		})
	}

	return yankiNotes
}

export async function deleteOrphanedDecks(
	client: YankiConnect,
	activeNotes: YankiNote[],
	recentlyDeletedNotes: YankiNote[],
	dryRun: boolean,
): Promise<string[]> {
	const activeNoteDeckNames = [...new Set(activeNotes.map((note) => note.deckName))].filter(
		Boolean,
	) as string[]

	const recentlyDeletedNoteDeckNames = [
		...new Set(recentlyDeletedNotes.map((note) => note.deckName)),
	].filter(Boolean) as string[]

	// Set that's excluded from set of notes deck names and recently deleted notes deck names
	const orphanedDeckNames = recentlyDeletedNoteDeckNames.filter(
		(deckName) => !activeNoteDeckNames.includes(deckName),
	)

	// Check the parent deck of each orphaned deck
	const orphanedParentDeckNames: string[] = []
	for (const orphanedDeckName of orphanedDeckNames) {
		const parts = orphanedDeckName.split('::')
		if (parts.length === 1) {
			continue
		}

		while (parts.length > 1) {
			parts.pop()
			const parentDeckName = parts.join('::')
			if (activeNoteDeckNames.some((deckName) => parentDeckName.includes(deckName))) {
				break
			}

			orphanedParentDeckNames.push(parentDeckName)
		}
	}

	const deckDeletionCandidates = [
		...new Set([...orphanedDeckNames, ...orphanedParentDeckNames]),
	] as string[]

	// Ensure all decks are actually empty
	const deckStats = await client.deck.getDeckStats({ decks: deckDeletionCandidates })
	const decksToDelete = Object.values(deckStats).reduce<string[]>((acc, deckStat) => {
		if (dryRun) {
			// Dry run is a special occasion...
			// The notes will still be there, so the deckStat's won't reflect emptiness
			// See if the number of notes in the deck is equal to the number of recently deleted
			// notes with that same deck
			const noteCount = recentlyDeletedNotes.reduce<number>((acc, note) => {
				if (note.deckName !== undefined) {
					const lastPart = note.deckName.split('::').at(-1)

					if (lastPart === deckStat.name) {
						return acc + 1
					}
				}

				return acc
			}, 0)

			if (noteCount === deckStat.total_in_deck) {
				acc.push(deckStat.name)
			}
		} else if (deckStat.total_in_deck === 0 && !acc.includes(deckStat.name)) {
			acc.push(deckStat.name)
		}

		return acc
	}, [])

	if (!dryRun) {
		await client.deck.deleteDecks({ cardsToo: true, decks: decksToDelete })
	}

	return decksToDelete
}

import { type YankiModelName, yankiModelNames, yankiModels } from '../model/model'
import { type YankiNote } from '../model/note'
import { extractMediaFromHtml } from '../parse/rehype-utilities'
import { defaultGlobalOptions } from '../shared/types'
import { getSlugifiedNamespace } from './namespace'
import { isUrl } from './url'
import { type YankiConnect } from 'yanki-connect'

export async function deleteNotes(client: YankiConnect, notes: YankiNote[], dryRun = false) {
	if (dryRun) {
		return
	}

	// TODO TypeScript regression
	// const noteIds = notes.map((note) => note.noteId).filter((noteId) => noteId !== undefined)
	const noteIds: number[] = []
	for (const note of notes) {
		if (note.noteId !== undefined) {
			noteIds.push(note.noteId)
		}
	}

	await client.note.deleteNotes({ notes: noteIds })
}

export async function deleteUnusedMedia(
	client: YankiConnect,
	liveNotes: YankiNote[],
	namespace: string,
	dryRun: boolean,
): Promise<string[]> {
	if (dryRun) {
		return []
	}

	// Note this always includes a `yanki-` prefix for ease of identification
	// in the Anki media asset manager UI
	const slugifiedNamespace = getSlugifiedNamespace(namespace)

	const activeMediaFilenames: string[] = []
	for (const note of liveNotes) {
		// Room for optimization to avoid re-parsing the HTML...
		const mediaPaths = extractMediaFromHtml(`${note.fields.Front}\n${note.fields.Back}`)
		for (const { filename } of mediaPaths) {
			activeMediaFilenames.push(filename)
		}
	}

	const allMediaInNamespace = await client.media.getMediaFilesNames({
		pattern: `${slugifiedNamespace}-*`,
	})

	const deletedMediaFilenames: string[] = []

	for (const remoteMediaFilename of allMediaInNamespace) {
		if (!activeMediaFilenames.includes(remoteMediaFilename)) {
			await client.media.deleteMediaFile({ filename: remoteMediaFilename })
			deletedMediaFilenames.push(remoteMediaFilename)
		}
	}

	return deletedMediaFilenames
}

export async function updateNoteModel(client: YankiConnect, note: YankiNote, dryRun = false) {
	if (note.noteId === undefined) {
		throw new Error('Note ID is undefined')
	}

	if (dryRun) {
		return
	}

	await client.note.updateNoteModel({
		note: { ...note, id: note.noteId, tags: note.tags ?? [] },
	})
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

// TODO actually get the local hash?
async function uploadMediaForNote(
	client: YankiConnect,
	note: YankiNote,
	dryRun: boolean,
): Promise<number> {
	// Upload media
	const mediaPaths = extractMediaFromHtml(`${note.fields.Front}\n${note.fields.Back}`)

	if (dryRun) {
		return mediaPaths.length
	}

	for (const { filename, originalSrc } of mediaPaths) {
		// Check if it already exists... TODO optimization
		const existing = await client.media.getMediaFilesNames({ pattern: filename })

		if (existing.length === 0) {
			const ankiMediaFilename = await client.media.storeMediaFile(
				isUrl(originalSrc)
					? {
							deleteExisting: true,
							filename,
							url: originalSrc,
						}
					: {
							deleteExisting: true,
							filename,
							path: originalSrc,
						},
			)

			if (filename !== ankiMediaFilename) {
				console.warn(
					`Anki media filename mismatch: Expected: "${filename}" -> Received: "${ankiMediaFilename}"`,
				)
			}
		} else {
			// Debugging
			// console.log(`Media file ${filename} already exists in Anki`)
		}
	}

	return mediaPaths.length
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
 * @param dryRun If true, the note will not be created and an ID of 0 will be returned
 * @returns The ID of the newly created note in Anki
 * @throws
 */
export async function addNote(
	client: YankiConnect,
	note: YankiNote,
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
					// Create the model and try again
					const model = yankiModels.find((model) => model.modelName === note.modelName)
					if (model === undefined) {
						throw new Error(`Model not found: ${note.modelName}`)
					}

					await client.model.createModel(model)

					return addNote(client, note, dryRun)
				}

				if (error.message === `deck was not found: ${note.deckName}`) {
					// Create the deck and try again

					if (note.deckName === '') {
						throw new Error('Deck name is empty')
					}

					await client.deck.createDeck({ deck: note.deckName })
					return addNote(client, note, dryRun)
				}

				// Do this in parse.ts instead to simplify future local / remote diffs
				// Anki won't create notes if the front field is blank, but we want
				// parity between markdown files and notes at all costs, so we'll put
				// in a placeholder if the front is empty.
				// if (error.message === 'cannot create note because it is empty') {
				// 	return addNote(
				// 		client,
				// 		// eslint-disable-next-line @typescript-eslint/naming-convention
				// 		{ ...note, fields: { ...note.fields, Front: '<p><em>(Empty)</em></p>' } },
				// 		dryRun,
				// 	)
				// }

				throw error
			} else {
				throw new TypeError('Unknown error')
			}
		})

	if (newNote === null) {
		throw new Error('Note creation failed')
	}

	await uploadMediaForNote(client, note, dryRun)

	return newNote
}

/**
 * Updates a note in Anki.
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
		!areFieldsEqual(localNote.fields, remoteNote.fields)
	) {
		if (!dryRun) {
			await client.note.updateNote({
				note: { ...localNote, id: localNote.noteId },
			})

			await uploadMediaForNote(client, localNote, dryRun)
		}

		updated = true
	}

	// Check if decks are different
	if (localNote.deckName !== remoteNote.deckName) {
		if (localNote.deckName === '') {
			throw new Error('Local deck name is empty')
		}

		if (!dryRun) {
			await client.deck.changeDeck({ cards: remoteNote.cards, deck: localNote.deckName })
		}

		updated = true
	}

	return updated
}

/**
 * Helper to compare field contents.
 *
 * @param localFields
 * @param remoteFields
 * @returns
 */
function areFieldsEqual(
	localFields: Record<string, string>,
	remoteFields: Record<string, string>,
): boolean {
	// Limit to front and back keys at the moment
	const keys = ['Front', 'Back']

	for (const key of keys) {
		if (localFields[key] !== remoteFields[key]) {
			return false
		}
	}

	return true
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
 * @param namespace The value of the YankiNamespace field, or search with '*' to get all notes. Defaults to the global default namespace.
 * @returns An array of YankiNote objects
 * @throws
 */
export async function getRemoteNotes(
	client: YankiConnect,
	namespace = defaultGlobalOptions.namespace,
): Promise<YankiNote[]> {
	const noteIds = await client.note.findNotes({ query: `"YankiNamespace:${namespace}"` })

	// We can trust that these are defined, since the list of notes is coming
	// straight from Anki
	return (await getRemoteNotesById(client, noteIds)) as YankiNote[]
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
 * @param namespace An instance of YankiConnect
 * @param noteIds An array of local note IDs to (attempt) to fetch @returns
 * Array of YankiNote objects, with undefined for notes that could not be found.
 * @throws
 */
export async function getRemoteNotesById(
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
			// Alternately, check if the model name is in the list of models and recreate by setting to undefined?
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
				// eslint-disable-next-line @typescript-eslint/naming-convention
				YankiNamespace: ankiNote.fields.YankiNamespace.value ?? '',
			},
			modelName: ankiNote.modelName as YankiModelName, // Checked above
			noteId: ankiNote.noteId,
			tags: ankiNote.tags,
		})
	}

	return yankiNotes
}

export async function deleteOrphanedDecks(
	client: YankiConnect,
	activeNotes: YankiNote[],
	originalNotes: YankiNote[],
	dryRun: boolean,
): Promise<string[]> {
	const activeNoteDeckNames = [...new Set(activeNotes.map((note) => note.deckName))].filter(Boolean)

	const originalNoteDeckNames = [...new Set(originalNotes.map((note) => note.deckName))].filter(
		Boolean,
	)

	// Set that's excluded from set of notes deck names and recently deleted notes deck names
	const orphanedDeckNames = originalNoteDeckNames.filter(
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
	const decksToDelete = Object.values(deckStats).reduce<string[]>((acc, deckStat, index) => {
		const deckPath = deckDeletionCandidates[index]

		if (dryRun) {
			// Get number of original cards in the deck, vs the number of cards in the deck now...
			// TODO test this
			const originalCount = originalNotes.filter((note) => note.deckName === deckPath).length
			const activeCount = activeNotes.filter((note) => note.deckName === deckPath).length
			if (
				deckStat.total_in_deck === originalCount &&
				activeCount === 0 &&
				!acc.includes(deckPath)
			) {
				acc.push(deckPath)
			}
		} else if (deckStat.total_in_deck === 0 && !acc.includes(deckPath)) {
			acc.push(deckPath)
		}

		return acc
	}, [])

	if (!dryRun) {
		await client.deck.deleteDecks({ cardsToo: true, decks: decksToDelete })
	}

	return decksToDelete
}

/**
 * Global! Does not respect namespace. You can write namespace checks into your css if you want.
 * @param client
 * @param modelName
 * @param css
 * @returns
 */
export async function updateModelStyle(
	client: YankiConnect,
	modelName: string,
	css: string,
	dryRun: boolean,
): Promise<boolean> {
	// Get original css

	// Create model on demand if necessary
	let currentCss: string | undefined
	try {
		const { css } = await client.model.modelStyling({ modelName })
		currentCss = css
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === `model was not found: ${modelName}`) {
				// Create the model and try again
				const model = yankiModels.find((model) => model.modelName === modelName)
				if (model === undefined) {
					throw new Error(`Model not found: ${modelName}`)
				}

				if (dryRun) {
					return false
				}

				await client.model.createModel(model)

				return updateModelStyle(client, model.modelName, css, dryRun)
			}

			throw error
		} else {
			throw new TypeError('Unknown error')
		}
	}

	if (currentCss !== undefined && currentCss === css) {
		return false
	}

	if (!dryRun) {
		await client.model.updateModelStyling({
			model: {
				css,
				name: modelName,
			},
		})
	}

	return true
}

// For testing

/**
 * For testing purposes only
 * @param client
 * @returns
 */
export async function createModels(client: YankiConnect) {
	for (const model of yankiModels) {
		try {
			await client.model.createModel(model)
		} catch (error) {
			if (error instanceof Error) {
				if (error.message === `Model name already exists`) {
					continue
				}

				throw error
			} else {
				throw new TypeError('Unknown error')
			}
		}
	}
}

/**
 * @param client
 * @param modelName
 * @returns css
 */
export async function getModelStyle(
	client: YankiConnect,
	modelName: string = yankiModelNames[0],
): Promise<string> {
	const { css } = await client.model.modelStyling({ modelName })
	return css
}

/**
 * @param client
 * @returns 'ankiUnreachable' if Anki is not open, or 'granted' if everything is copacetic
 * @throws if access is denied
 */
export async function requestPermission(
	client: YankiConnect,
): Promise<'ankiUnreachable' | 'granted'> {
	try {
		const { permission } = await client.miscellaneous.requestPermission()

		if (permission === 'denied') {
			throw new Error(
				'Permission denied, please add this source to the "webCorsOriginList" in the Anki-Connect add-on configuration options.',
			)
		} else {
			return 'granted'
		}
	} catch (error) {
		if (
			error instanceof Error &&
			// Accommodate error message from requestUrl in Obsidian as well
			(error.message === 'fetch failed' || error.message === 'net::ERR_CONNECTION_REFUSED')
		) {
			return 'ankiUnreachable'
		}

		throw error
	}
}

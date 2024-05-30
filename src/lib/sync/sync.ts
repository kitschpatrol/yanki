import { setNoteIdInFrontmatter } from '../model/frontmatter'
import { type YankiNote } from '../model/yanki-note'
import { getNoteFromMarkdown } from '../parse/parse'
import { addNote, getRemoteNotes, updateNote } from './anki-connect-utilities'
import fs from 'node:fs/promises'
import path from 'node:path'
import { YankiConnect, type YankiConnectOptions } from 'yanki-connect'

type SyncedNote = { action: 'created' | 'recreated' | 'unchanged' | 'updated'; note: YankiNote }

type SyncNoteOptions = {
	ankiConnectOptions?: YankiConnectOptions
	defaultDeckName?: string
}

/**
 * Syncs local notes to Anki.
 *
 * @param allLocalNotes All the YankiNotes to sync
 * @returns The synced notes (with new IDs where applicable), plus some stats
 * about the sync @throws
 */
export async function syncNotes(
	allLocalNotes: YankiNote[],
	options?: SyncNoteOptions,
): Promise<{
	deleted: number[]
	duration: number
	synced: SyncedNote[]
}> {
	const startTime = performance.now()
	const synced: SyncedNote[] = []
	const replaced: number[] = []

	const {
		ankiConnectOptions = {
			autoLaunchAnki: true,
		},
		defaultDeckName = 'Yanki',
	} = options ?? {}

	const client = new YankiConnect(ankiConnectOptions)

	const remoteNoteIds = await client.note.findNotes({ query: 'note:"Yanki - *"' })

	// Deletion pass
	const orphans = remoteNoteIds.filter(
		(note) => !allLocalNotes.some((localNote) => localNote.noteId === note),
	)
	await client.note.deleteNotes({ notes: orphans })

	// Set undefined local note decks to the default
	for (const note of allLocalNotes) {
		if (note.deckName === undefined) {
			console.log('Setting deck name')
			note.deckName = defaultDeckName
		}
	}

	// Set undefined local note IDs to bogus ones to ensure we create them
	const localNoteIds = allLocalNotes.map((note) => note.noteId).map((id) => id ?? -1)
	const remoteNotes = await getRemoteNotes(client, localNoteIds)

	// Creation and update pass
	for (const [index, remoteNote] of remoteNotes.entries()) {
		const localNote = allLocalNotes[index]

		// Undefined means the note only exists locally
		if (remoteNote === undefined) {
			// Ensure id is undefined, in case the local id is corrupted (e.g. changed
			// by hand)
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
			// Model change, need to recreate TODO is there a way to "update" a note
			// model?

			if (remoteNote.noteId === undefined) {
				throw new Error('Remote note ID is undefined')
			}

			replaced.push(remoteNote.noteId)
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
		deleted: [...orphans, ...replaced],
		duration: performance.now() - startTime,
		synced,
	}
}

type SyncedNoteFile = {
	filePath: string
} & SyncedNote

type SyncNoteFilesOptions = {
	ankiConnectOptions?: YankiConnectOptions
}

/**
 * Sync a list of local yanki-md files to Anki.
 *
 * Wraps the syncNotes function to handle file I/O.
 *
 * Most importantly, it updates the note IDs in the frontmatter of the local
 * files.
 *
 * @param allLocalFilePaths
 * @returns The synced files (with new IDs where applicable), plus some stats
 * about the sync @throws
 */
export async function syncNoteFiles(
	allLocalFilePaths: string[],
	options?: SyncNoteFilesOptions,
): Promise<{ deleted: number[]; duration: number; synced: SyncedNoteFile[] }> {
	const startTime = performance.now()

	const allLocalMarkdown: string[] = []
	const allLocalNotes: YankiNote[] = []

	// Use file paths as deck names if they're not provided in the frontmatter
	const deckNamesFromFilePaths = getDeckNamesFromFilePaths(allLocalFilePaths, true)

	for (const [index, filePath] of allLocalFilePaths.entries()) {
		const markdown = await fs.readFile(filePath, 'utf8')
		allLocalMarkdown.push(markdown)
		const note = await getNoteFromMarkdown(markdown)
		note.deckName ??= deckNamesFromFilePaths[index]
		allLocalNotes.push(note)
	}

	const { deleted, synced } = await syncNotes(allLocalNotes, options)

	// Write IDs to the local files as necessary Can't just get markdown from the
	// note because there might be extra frontmatter from e.g. obsidian, which is
	// not captured in the YankiNote type
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
		duration: performance.now() - startTime,
		synced: syncedFiles,
	}
}

function getDeckNamesFromFilePaths(filePaths: string[], prune: boolean) {
	const filePathSegments = filePaths.map((filePath) =>
		path.dirname(path.resolve(filePath)).split(path.sep),
	)

	const deckNames = filePathSegments.map((pathSegments) => {
		if (prune) {
			// Walk right to left, only go as far as you find another file
			// This means "islands" become their own root if there aren't and
			// markdown files in the parent directory
			for (let index = pathSegments.length - 2; index >= 0; index--) {
				// See if the segment is the "last path" in another file
				if (
					!filePathSegments.some(
						(otherPathSegments) => otherPathSegments.at(-1) === pathSegments[index],
					)
				) {
					return pathSegments.slice(index + 1).join('::')
				}
			}
		} else {
			console.log('empty-allowed')
			// Walk from left to right, stop when you find the first segment with a file
			for (let index = 0; index < pathSegments.length; index++) {
				if (
					filePathSegments.some(
						(otherPathSegments) => otherPathSegments.at(-1) === pathSegments[index],
					)
				) {
					return pathSegments.slice(index).join('::')
				}
			}
		}

		// If we didn't find another file, return the whole path
		// This should not happen...
		return pathSegments.join('::')
	})

	return deckNames
}

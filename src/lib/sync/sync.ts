import { setNoteIdInFrontmatter } from '../model/frontmatter'
import { type YankiNote } from '../model/yanki-note'
import { getNoteFromMarkdown } from '../parse/parse'
import { addNote, getRemoteNotes, updateNote } from './anki-connect-utilities'
import fs from 'node:fs/promises'
import { YankiConnect, type YankiConnectOptions } from 'yanki-connect'

type SyncedNote = { action: 'created' | 'recreated' | 'unchanged' | 'updated'; note: YankiNote }

/**
 * Syncs local notes to Anki.
 *
 * @param allLocalNotes All the YankiNotes to sync
 * @returns The synced notes (with new IDs where applicable), plus some stats
 * about the sync @throws
 */
export async function syncNotes(
	allLocalNotes: YankiNote[],
	ankiConnectOptions?: YankiConnectOptions,
): Promise<{
	deleted: number[]
	duration: number
	synced: SyncedNote[]
}> {
	const startTime = performance.now()
	const synced: SyncedNote[] = []
	const replaced: number[] = []

	const client = new YankiConnect(ankiConnectOptions)

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
	ankiConnectOptions?: YankiConnectOptions,
): Promise<{ deleted: number[]; duration: number; synced: SyncedNoteFile[] }> {
	const startTime = performance.now()

	const allLocalMarkdown: string[] = []
	const allLocalNotes: YankiNote[] = []
	for (const filePath of allLocalFilePaths) {
		const markdown = await fs.readFile(filePath, 'utf8')
		allLocalMarkdown.push(markdown)
		allLocalNotes.push(await getNoteFromMarkdown(markdown))
	}

	const { deleted, synced } = await syncNotes(allLocalNotes, ankiConnectOptions)

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

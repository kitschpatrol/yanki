import { type YankiNote, listNotes, syncNotes } from '../src/lib'
import { expect, it } from 'vitest'

it('lists notes', async () => {
	// Mock data
	const namespace = 'Yanki Test - list.browser.test'
	const testNote: YankiNote = {
		deckName: 'test-minimal-notes',
		fields: {
			Back: 'Bye',
			Front: 'Hi',
			YankiNamespace: namespace,
		},
		modelName: 'Yanki - Basic',
		noteId: undefined,
		tags: [],
	}

	await syncNotes([testNote], {
		namespace,
	})

	const notes = await listNotes({ namespace })
	expect(notes.notes.length).toBeGreaterThan(0)

	await syncNotes([], {
		namespace,
	})

	const noNotes = await listNotes({ namespace })
	expect(noNotes.notes.length).toBe(0)
})

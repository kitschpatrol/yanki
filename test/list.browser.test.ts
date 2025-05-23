import { expect, it } from 'vitest'
import type { YankiNote } from '../src/lib'
import { listNotes, syncNotes } from '../src/lib'

// Unused, yanki-connect uses browser fetch automatically if available
// Browser fetch adapter example
// async function fetchAdapter(
// 	url: Parameters<FetchAdapter>['0'],
// 	options: Parameters<FetchAdapter>['1'],
// ): ReturnType<FetchAdapter> {
// 	// eslint-disable-next-line node/no-unsupported-features/node-builtins
// 	return fetch(url, options)
// }

it('lists notes', { only: true }, async () => {
	// Mock data
	const namespace = 'Yanki Test - list.browser.test'
	const testNote: YankiNote = {
		deckName: 'test-browser-notes',
		fields: {
			Back: 'Bye',
			Front: 'Hi',
			YankiNamespace: namespace,
		},
		modelName: 'Yanki - Basic',
		noteId: undefined,
		tags: [],
	}

	try {
		await syncNotes([testNote])
	} catch (error) {
		console.log(error)
	}

	const notes = await listNotes({ namespace })

	expect(notes.notes.length).toBeGreaterThan(0)

	await syncNotes([], {
		namespace,
	})

	const noNotes = await listNotes({ namespace })
	expect(noNotes.notes.length).toBe(0)
})

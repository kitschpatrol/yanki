import { expect, it } from 'vitest'
import { listNotes, syncNotes, type YankiNote } from '../src/lib'

// Browser fetch adapter example
// async function fetchAdapter(
// 	url: Parameters<FetchAdapter>['0'],
// 	options: Parameters<FetchAdapter>['1'],
// ): ReturnType<FetchAdapter> {
// 	// eslint-disable-next-line node/no-unsupported-features/node-builtins
// 	return fetch(url, options)
// }

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

	try {
		await syncNotes([testNote], {
			ankiConnectOptions: {
				// Unused, yanki-connect uses browser fetch automatically if available
				// fetchAdapter,
			},
		})
	} catch (error) {
		console.log(error)
		// Assert(false, String(error))
	}

	const notes = await listNotes({ namespace })

	expect(notes.notes.length).toBeGreaterThan(0)

	await syncNotes([], {
		namespace,
	})

	const noNotes = await listNotes({ namespace })
	expect(noNotes.notes.length).toBe(0)
})

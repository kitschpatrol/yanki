import { type FileAdapter, getNoteFromMarkdown, syncNotes } from '../src/lib'
import { expect, it } from 'vitest'

it('syncs notes', async () => {
	const namespace = 'yanki.sync.browser.test'

	const fileAdapter: FileAdapter = {
		// eslint-disable-next-line @typescript-eslint/require-await
		async readFile() {
			throw new Error('Not implemented')
		},
		// eslint-disable-next-line @typescript-eslint/require-await
		async readFileBuffer() {
			throw new Error('Not implemented')
		},
		// eslint-disable-next-line @typescript-eslint/require-await
		async rename() {
			throw new Error('Not implemented')
		},
		// eslint-disable-next-line @typescript-eslint/require-await
		async stat() {
			throw new Error('Not implemented')
		},
		// eslint-disable-next-line @typescript-eslint/require-await
		async writeFile() {
			throw new Error('Not implemented')
		},
	}

	const note = await getNoteFromMarkdown('**The Cauchy-Schwarz Inequality**\n\n---\n\nThe back!', {
		fileAdapter,
		namespace,
	})

	expect(note).toMatchInlineSnapshot(`
		{
		  "deckName": "",
		  "fields": {
		    "Back": "<div class="yanki namespace-yanki-sync-browser-test back model-yanki-basic">
		<p>The back!</p>
		</div>",
		    "Front": "<div class="yanki namespace-yanki-sync-browser-test front model-yanki-basic">
		<p><strong>The Cauchy-Schwarz Inequality</strong></p>
		</div>",
		    "YankiNamespace": "yanki.sync.browser.test",
		  },
		  "modelName": "Yanki - Basic",
		  "noteId": undefined,
		  "tags": [],
		}
	`)

	const syncResult = await syncNotes([note], { namespace })

	// Stable results
	syncResult.duration = 0
	syncResult.synced[0].note.noteId = 0

	expect(syncResult).toMatchInlineSnapshot(`
		{
		  "ankiWeb": false,
		  "deletedDecks": [],
		  "deletedMedia": [],
		  "dryRun": false,
		  "duration": 0,
		  "namespace": "yanki.sync.browser.test",
		  "synced": [
		    {
		      "action": "created",
		      "note": {
		        "deckName": "Yanki",
		        "fields": {
		          "Back": "<div class="yanki namespace-yanki-sync-browser-test back model-yanki-basic">
		<p>The back!</p>
		</div>",
		          "Front": "<div class="yanki namespace-yanki-sync-browser-test front model-yanki-basic">
		<p><strong>The Cauchy-Schwarz Inequality</strong></p>
		</div>",
		          "YankiNamespace": "yanki.sync.browser.test",
		        },
		        "modelName": "Yanki - Basic",
		        "noteId": 0,
		        "tags": [],
		      },
		    },
		  ],
		}
	`)

	// Clean up
	await syncNotes([], { namespace })
})

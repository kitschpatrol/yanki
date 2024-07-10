import { listNotes } from '../src/lib'
import { expect, it } from 'vitest'

it('lists notes', async () => {
	const notes = await listNotes({ namespace: '*' })

	expect(notes.notes.length).toBeGreaterThan(0)
})

// TODO

export async function invoke(
	action: string,
	version = 6,
	params: Record<string, unknown> = {},
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
	try {
		const response = await fetch('http://127.0.0.1:8765', {
			body: JSON.stringify({ action, params, version }),
			headers: {
				'Content-Type': 'application/json',
			},
			method: 'POST',
		})

		if (!response.ok) {
			throw new Error('failed to issue request')
		}

		const data = (await response.json()) as Record<string, unknown>

		if (Object.keys(data).length !== 2) {
			throw new Error('response has an unexpected number of fields')
		}

		return data.result
	} catch (error) {
		throw new Error(`Request failed: ${String(error)}`)
	}
}

// Const noteIds = (await invoke('findNotes', 6, {
// 	query: 'deck:Default',
// })) as number[]

// const notes = (await invoke('notesInfo', 6, {
// 	notes: noteIds,
// })) as number[]

// console.log('----------------------------------')
// for (const note of notes) {
// 	console.log(note)
// }

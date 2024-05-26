export type AnkiNoteType =
	| 'Basic (and reversed card)'
	| 'Basic (type in the answer)'
	| 'Basic'
	| 'Cloze'

export type AnkiNote = {
	// Mdank specific
	deck: string
	fields: {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Back: {
			order: number
			value: string
		}
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Front: {
			order: number
			value: string
		}
	}
	modelName: AnkiNoteType
	noteId: number | undefined
	tags: string[]
	// Don't care
	// cards: number[]
}

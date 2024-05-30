/* eslint-disable @typescript-eslint/naming-convention */
import { type Simplify } from 'type-fest'
import { type YankiParamsForAction } from 'yanki-connect'

export function getYankiModels(prefix: string): Array<YankiParamsForAction<'createModel'>> {
	return [
		{
			cardTemplates: [
				{
					Back: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
					Front: '{{Front}}',
				},
			],
			inOrderFields: ['Front', 'Back'],
			modelName: `${prefix}Basic`,
		},
		{
			cardTemplates: [
				{
					Back: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
					Front: '{{Front}}',
				},
				{
					Back: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Front}}',
					Front: '{{Back}}',
				},
			],
			inOrderFields: ['Front', 'Back'],
			modelName: `${prefix}Basic (and reversed card)`,
		},
		{
			// Changing the template structure slightly from the Anki defaults for
			// simplicity (instead of Text and Back Extra, we just have Back and Front)
			cardTemplates: [
				{
					Back: '{{cloze:Front}}<br>\n{{Back}}',
					Front: '{{cloze:Front}}',
				},
			],
			inOrderFields: ['Front', 'Back'],
			isCloze: true,
			modelName: `${prefix}Cloze`,
		},
		{
			cardTemplates: [
				{
					Back: '{{Front}}\n\n<hr id=answer>\n\n{{type:Back}}',
					Front: '{{Front}}\n\n{{type:Back}}',
				},
			],
			inOrderFields: ['Front', 'Back'],
			modelName: `${prefix}Basic (type in the answer)`,
		},
	]
}

export function getYankiModelNames(prefix: string): string[] {
	return getYankiModels(prefix).map((model) => model.modelName)
}

export type YankiNote = Simplify<
	{
		cards?: number[]
		fields: { Back: string; Front: string }
		modelName: string
		noteId: number | undefined
	} & Omit<YankiParamsForAction<'addNote'>['note'], 'fields' | 'modelName' | 'options'>
>

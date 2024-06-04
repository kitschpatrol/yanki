/* eslint-disable @typescript-eslint/naming-convention */
import { type Simplify } from 'type-fest'
import { type YankiParamsForAction } from 'yanki-connect'

export const yankiModels = [
	{
		cardTemplates: [
			{
				Back: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
				Front: '{{Front}}',
				YankiNamespace: '{{YankiNamespace}}',
			},
		],
		inOrderFields: ['Front', 'Back', 'YankiNamespace'],
		modelName: 'Yanki - Basic',
	},
	{
		cardTemplates: [
			{
				Back: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
				Front: '{{Front}}',
				YankiNamespace: '{{YankiNamespace}}',
			},
			{
				Back: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Front}}',
				Front: '{{Back}}',
				YankiNamespace: '{{YankiNamespace}}',
			},
		],
		inOrderFields: ['Front', 'Back', 'YankiNamespace'],
		modelName: 'Yanki - Basic (and reversed card)',
	},
	{
		// Changing the template structure slightly from the Anki defaults for
		// simplicity (instead of Text and Back Extra, we just have Back and Front)
		cardTemplates: [
			{
				Back: '{{cloze:Front}}<br>\n{{Back}}',
				Front: '{{cloze:Front}}',
				YankiNamespace: '{{YankiNamespace}}',
			},
		],
		inOrderFields: ['Front', 'Back', 'YankiNamespace'],
		isCloze: true,
		modelName: 'Yanki - Cloze',
	},
	{
		cardTemplates: [
			{
				Back: '{{Front}}\n\n<hr id=answer>\n\n{{type:Back}}',
				Front: '{{Front}}\n\n{{type:Back}}',
				YankiNamespace: '{{YankiNamespace}}',
			},
		],
		inOrderFields: ['Front', 'Back', 'YankiNamespace'],
		modelName: 'Yanki - Basic (type in the answer)',
	},
] as const satisfies Array<YankiParamsForAction<'createModel'>>

export type YankiModelName = (typeof yankiModels)[number]['modelName']
export const yankiModelNames: YankiModelName[] = yankiModels.map((model) => model.modelName)

export type YankiNote = Simplify<
	{
		cards?: number[]
		fields: { Back: string; Front: string; YankiNamespace: string }
		modelName: YankiModelName
		noteId: number | undefined
	} & Omit<YankiParamsForAction<'addNote'>['note'], 'fields' | 'modelName' | 'options'>
>

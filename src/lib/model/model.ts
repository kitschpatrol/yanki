/* eslint-disable @typescript-eslint/naming-convention */

import { type YankiParamsForAction } from 'yanki-connect'

export type YankiModel = YankiParamsForAction<'createModel'>

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
	{
		cardTemplates: [
			{
				Back: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}{{#Extra}}\n\n<hr>\n\n{{Extra}}{{/Extra}}',
				Front: '{{Front}}',
				YankiNamespace: '{{YankiNamespace}}',
			},
			{
				Back: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Front}}{{#Extra}}\n\n<hr>\n\n{{Extra}}{{/Extra}}',
				Front: '{{Back}}',
				YankiNamespace: '{{YankiNamespace}}',
			},
		],
		inOrderFields: ['Front', 'Back', 'Extra', 'YankiNamespace'],
		modelName: 'Yanki - Basic (and reversed card with extra)',
	},
] as const satisfies YankiModel[]

export type YankiModelName = (typeof yankiModels)[number]['modelName']

export const yankiModelNames: YankiModelName[] = yankiModels.map((model) => model.modelName)

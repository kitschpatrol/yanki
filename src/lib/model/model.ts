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
] as const satisfies YankiModel[]

export type YankiModelName = (typeof yankiModels)[number]['modelName']

export const yankiModelNames: YankiModelName[] = yankiModels.map((model) => model.modelName)

// Via https://github.com/ankitects/anki/blob/e41c4573d789afe8b020fab5d9d1eede50c3fa3d/qt/aqt/editor.py#L62
export const yankiSupportedImageFormats = [
	'avif',
	'gif',
	'ico',
	'jpeg',
	'jpg',
	'png',
	'svg',
	'tif',
	'tiff',
	'webp',
] as const

// Via https://github.com/ankitects/anki/blob/e41c4573d789afe8b020fab5d9d1eede50c3fa3d/qt/aqt/editor.py#L63-L85
export const yankiSupportedAudioVideoFormats = [
	'3gp',
	'aac',
	'avi',
	'flac',
	'flv',
	'm4a',
	'mkv',
	'mov',
	'mp3',
	'mp4',
	'mpeg',
	'mpg',
	'oga',
	'ogg',
	'ogv',
	'ogx',
	'opus',
	'spx',
	'swf',
	'wav',
	'webm',
] as const

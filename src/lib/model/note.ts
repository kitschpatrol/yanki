import { type Simplify } from 'type-fest'
import { type YankiParamsForAction } from 'yanki-connect'
import type { YankiModelName } from './model'

export type YankiNote = Simplify<
	{
		cards?: number[]
		fields: {
			Back: string
			// Currently onl Yanki - Basic (and reversed card with extra) has this field
			Extra?: string
			Front: string
			YankiNamespace: string
		}
		modelName: YankiModelName
		noteId: number | undefined
	} & Omit<YankiParamsForAction<'addNote'>['note'], 'fields' | 'modelName' | 'options'>
>

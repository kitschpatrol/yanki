/* eslint-disable @typescript-eslint/naming-convention */

import type { YankiModelName } from './model'
import { type Simplify } from 'type-fest'
import { type YankiParamsForAction } from 'yanki-connect'

export type YankiNote = Simplify<
	{
		cards?: number[]
		fields: { Back: string; Front: string; YankiNamespace: string }
		modelName: YankiModelName
		noteId: number | undefined
	} & Omit<YankiParamsForAction<'addNote'>['note'], 'fields' | 'modelName' | 'options'>
>

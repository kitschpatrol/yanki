import { u } from 'unist-builder'

export const yankiDefaultCssClassName = 'yanki'

export const yankiDefaultNamespace = 'Yanki CLI'

export const yankiDefaultEmptyNotePlaceholderHast = u('root', [
	u(
		'element',
		{
			properties: {},
			tagName: 'p',
		},
		[
			u(
				'element',
				{
					properties: {},
					tagName: 'em',
				},
				[u('text', '(Empty)')],
			),
		],
	),
])

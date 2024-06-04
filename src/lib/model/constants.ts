import { u } from 'unist-builder'

export const defaultCss = `.card {
  font-family: arial;
  font-size: 20px;
  text-align: center;
  color: black;
  background-color: white;
}`

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

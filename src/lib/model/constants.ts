import { u } from 'unist-builder'

// Settings that really don't belong in option arguments...

export const yankiDefaultCss = `.card {
  font-family: arial;
  font-size: 20px;
  text-align: center;
  color: black;
  background-color: white;
}`

export const yankiDefaultDeckName = 'Yanki'

export const yankiDefaultCssClassName = 'yanki'

export const yankiDefaultEmptyNotePlaceholderText = '(Empty)'

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
				[u('text', yankiDefaultEmptyNotePlaceholderText)],
			),
		],
	),
])

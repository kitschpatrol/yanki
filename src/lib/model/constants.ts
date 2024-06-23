import { u } from 'unist-builder'

// Settings that really don't belong in option arguments...

export const yankiDefaultCss = `
	.card {
		font-family: arial;
		font-size: 20px;
		text-align: center;
		color: black;
		background-color: white;
	}
`

// Anki enforces limits on media asset filenames. Older versions allowed up to 255, but it will be 120 moving forward.
// https://github.com/ankitects/anki/blob/e41c4573d789afe8b020fab5d9d1eede50c3fa3d/rslib/src/sync/media/mod.rs#L20
export const yankiMaxMediaFilenameLength = 120

export const yankiMaxNamespaceLength = 40

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

import { u } from 'unist-builder'

export const defaultCss = `.card {
  font-family: arial;
  font-size: 20px;
  text-align: center;
  color: black;
  background-color: white;
}`

/**
 * Whether to require changes to notes, models, or decks before invoking an
 * AnkiWeb sync. Seems like a good idea, but this is tricky... because if you
 * change the AnkiWeb flag after doing a sync, and haven't changed any files,
 * you won't end up pushing changes to AnkiWeb, which seems to contradict
 * expectations even though it would be more performant in the typical case.
 *
 * Still requires the AnkiWeb flag to be true.
 * */
export const yankiSyncToAnkiWebEvenIfUnchanged = true

export const yankiDefaultCssClassName = 'yanki'

export const yankiDefaultNamespace = 'Yanki'

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

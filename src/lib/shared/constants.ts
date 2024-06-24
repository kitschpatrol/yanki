import { css } from '../utilities/string'
import { u } from 'unist-builder'

// These are configurations that should be relatively static and don't warrant cluttering option arguments.
// Other defaults are defined in options.ts.

/**
 * The default CSS to use for cards. This matches Anki's default. Stored in the Yanki card models and shared across all Yanki-managed notes regardless of namespace.
 */
export const CSS_DEFAULT_STYLE = css`
	.card {
		font-family: arial;
		font-size: 20px;
		text-align: center;
		color: black;
		background-color: white;
	}
`

/**
 * CSS class to always include in a top-level div wrapper in the card template to allow for custom styling.
 */
export const CSS_DEFAULT_CLASS_NAME = 'yanki'

/**
 * Whether to require changes to notes, models, or decks before invoking an
 * AnkiWeb sync. Seems like a good idea, but this is tricky... because if you
 * change the AnkiWeb flag after doing a sync, and haven't changed any files,
 * you won't end up pushing changes to AnkiWeb, which seems to contradict
 * expectations even though it would be more performant in the typical case.
 *
 * Only applies if the `ankiWeb` flag is true.
 */
export const SYNC_TO_ANKI_WEB_EVEN_IF_UNCHANGED = true

/**
 * The maximum length of a namespace. This is used to ensure that the namespace
 * is easy to type in CLI commands and doesn't hog too much semantic space in
 * Media filenames.
 */
export const NOTE_NAMESPACE_MAX_LENGTH = 40

/**
 * The default deck to put a card in if the deck deck can not be inferred from
 * the file path, e.g. when the `sync` command is used directly instead of
 * `syncFiles`.
 */
export const NOTE_DEFAULT_DECK_NAME = 'Yanki'

/**
 * Text to show if a note 'Front' field is empty, and content is required for a semantically valid card.
 */
export const NOTE_DEFAULT_EMPTY_TEXT = '(Empty)'

/**
 * HTML element to use to present `NOTE_DEFAULT_EMPTY_TEXT`.
 * TODO consider hidden span?
 */
export const NOTE_DEFAULT_EMPTY_HAST = u('root', [
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
				[u('text', NOTE_DEFAULT_EMPTY_TEXT)],
			),
		],
	),
])

/**
 * How / where to get a hash to determine if media assets have changes.
 */
export type MediaHashMode = 'content' | 'metadata' | 'name'
export const MEDIA_DEFAULT_HASH_MODE_FILE: MediaHashMode = 'content'
export const MEDIA_DEFAULT_HASH_MODE_URL: MediaHashMode = 'metadata'

/**
 * How to infer the asset type behind a URL.
 *
 * - `metadata`: Fetch the head and hope for a `Content-Type` header.
 * - `name`: Infer the extension from the URL alone, won't work if there's nothing extension-like in the `pathname`.
 */
export const MEDIA_URL_CONTENT_TYPE_MODE: 'metadata' | 'name' = 'metadata'

/**
 * Set the extension to `unknown` if the URL extension can't be determined...
 * lets a URL media asset sync to Anki, and then the browser can figure out how
 * to display at runtime. Trades some risk for unsupported assets being synced
 * for the seemingly more common case of asset URLs that don't include an
 * extension or have a valid content-type header.
 */
export const MEDIA_ALLOW_UNKNOWN_URL_EXTENSION = true

/**
 * Anki enforces limits on media asset filenames. Older versions allowed up to 255, but it will be 120 moving forward.
 * https://github.com/ankitects/anki/blob/e41c4573d789afe8b020fab5d9d1eede50c3fa3d/rslib/src/sync/media/mod.rs#L20
 */
export const MEDIA_FILENAME_MAX_LENGTH = 120

/**
 * Filename to use when a media asset has no name. Will be appended with counter parenthetical as needed.
 */
export const MEDIA_DEFAULT_EMPTY_FILENAME = 'Untitled'

/**
 * Supported image extensions for Anki media assets.
 *
 * Note that while officially "supported", some of these are not universally compatible across Anki platforms.
 *
 * Via https://github.com/ankitects/anki/blob/e41c4573d789afe8b020fab5d9d1eede50c3fa3d/qt/aqt/editor.py#L62
 */
export const MEDIA_SUPPORTED_IMAGE_EXTENSIONS = [
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

/**
 * Supported audio / video extensions for Anki media assets.
 *
 * Note that while officially "supported", some of these are not universally compatible across Anki platforms.
 *
 * Via https://github.com/ankitects/anki/blob/e41c4573d789afe8b020fab5d9d1eede50c3fa3d/qt/aqt/editor.py#L63-L85
 */
export const MEDIA_SUPPORTED_AUDIO_VIDEO_EXTENSIONS = [
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

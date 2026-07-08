/* eslint-disable regexp/control-character-escape */
/* eslint-disable no-control-regex */
import slugify from '@sindresorhus/slugify'
import { NOTE_NAMESPACE_MAX_LENGTH } from '../shared/constants'

const CONSECUTIVE_HYPHENS_REGEX = /-+/gv
const ASTERISK_REGEX = /\*/v

// prettier-ignore
const FORBIDDEN_CHARACTERS: Array<[RegExp, string]> = [
	// Yanki-specific forbidden characters
	[/:/v, 'Colon'],
	// ASCII control characters (C0 Controls)
	[/\u{0000}/v, 'Null'],
	[/\u{0001}/v, 'Start of Heading'],
	[/\u{0002}/v, 'Start of Text'],
	[/\u{0003}/v, 'End of Text'],
	[/\u{0004}/v, 'End of Transmission'],
	[/\u{0005}/v, 'Enquiry'],
	[/\u{0006}/v, 'Acknowledge'],
	[/\u{0007}/v, 'Bell'],
	[/\u{0008}/v, 'Backspace'],
	[/\u{0009}/v, 'Horizontal Tab'],
	[/\u{000A}/v, 'Line Feed'],
	[/\u{000B}/v, 'Vertical Tab'],
	[/\u{000C}/v, 'Form Feed'],
	[/\u{000D}/v, 'Carriage Return'],
	[/\u{000E}/v, 'Shift Out'],
	[/\u{000F}/v, 'Shift In'],
	[/\u{0010}/v, 'Data Link Escape'],
	[/\u{0011}/v, 'Device Control 1'],
	[/\u{0012}/v, 'Device Control 2'],
	[/\u{0013}/v, 'Device Control 3'],
	[/\u{0014}/v, 'Device Control 4'],
	[/\u{0015}/v, 'Negative Acknowledge'],
	[/\u{0016}/v, 'Synchronous Idle'],
	[/\u{0017}/v, 'End of Transmission Block'],
	[/\u{0018}/v, 'Cancel'],
	[/\u{0019}/v, 'End of Medium'],
	[/\u{001A}/v, 'Substitute'],
	[/\u{001B}/v, 'Escape'],
	[/\u{001C}/v, 'File Separator'],
	[/\u{001D}/v, 'Group Separator'],
	[/\u{001E}/v, 'Record Separator'],
	[/\u{001F}/v, 'Unit Separator'],
	[/\u{007F}/v, 'Delete'],
	// C1 Controls and Latin-1 Supplement
	[/\u{0080}/v, 'Padding Character'],
	[/\u{0081}/v, 'High Octet Preset'],
	[/\u{0082}/v, 'Break Permitted Here'],
	[/\u{0083}/v, 'No Break Here'],
	[/\u{0084}/v, 'Index'],
	[/\u{0085}/v, 'Next Line'],
	[/\u{0086}/v, 'Start of Selected Area'],
	[/\u{0087}/v, 'End of Selected Area'],
	[/\u{0088}/v, 'Character Tabulation Set'],
	[/\u{0089}/v, 'Character Tabulation with Justification'],
	[/\u{008A}/v, 'Line Tabulation Set'],
	[/\u{008B}/v, 'Partial Line Forward'],
	[/\u{008C}/v, 'Partial Line Backward'],
	[/\u{008D}/v, 'Reverse Line Feed'],
	[/\u{008E}/v, 'Single Shift Two'],
	[/\u{008F}/v, 'Single Shift Three'],
	[/\u{0090}/v, 'Device Control String'],
	[/\u{0091}/v, 'Private Use One'],
	[/\u{0092}/v, 'Private Use Two'],
	[/\u{0093}/v, 'Set Transmit State'],
	[/\u{0094}/v, 'Cancel Character'],
	[/\u{0095}/v, 'Message Waiting'],
	[/\u{0096}/v, 'Start of Protected Area'],
	[/\u{0097}/v, 'End of Protected Area'],
	[/\u{0098}/v, 'Start of String'],
	[/\u{0099}/v, 'Single Graphic Character Introducer'],
	[/\u{009A}/v, 'Single Character Introducer'],
	[/\u{009B}/v, 'Control Sequence Introducer'],
	[/\u{009C}/v, 'String Terminator'],
	[/\u{009D}/v, 'Operating System Command'],
	[/\u{009E}/v, 'Privacy Message'],
	[/\u{009F}/v, 'Application Program Command'],
	[/\u{00A0}/v, 'Non-breaking Space'],
	[/\u{00AD}/v, 'Soft Hyphen'],
	// Additional Unicode non-printable characters
	[/\u{200B}/v, 'Zero-width Space'],
	[/\u{200C}/v, 'Zero-width Non-joiner'],
	[/\u{200D}/v, 'Zero-width Joiner'],
	[/\u{200E}/v, 'Left-to-right Mark'],
	[/\u{200F}/v, 'Right-to-left Mark'],
	[/\u{202A}/v, 'Left-to-right Embedding'],
	[/\u{202B}/v, 'Right-to-left Embedding'],
	[/\u{202C}/v, 'Pop Directional Formatting'],
	[/\u{202D}/v, 'Left-to-right Override'],
	[/\u{202E}/v, 'Right-to-left Override'],
	[/\u{FEFF}/v, 'Byte Order Mark (BOM)'],
]

/**
 * Convenience
 *
 * @returns Sanitized valid namespace
 * @throws {Error} If namespace is invalid
 */
export function validateAndSanitizeNamespace(namespace: string, allowAsterisk = false): string {
	validateNamespace(namespace, allowAsterisk)
	return sanitizeNamespace(namespace)
}

/**
 * Used internally before storing and searching
 *
 * @returns Sanitized namespace
 */
export function sanitizeNamespace(namespace: string): string {
	// Forgive weird unicode and leading / trailing spaces
	return namespace.normalize('NFC').trim()
}

/**
 * Used whenever a users is creating data with a namespace they've provided.
 *
 * Note that namespaces are case insensitive!
 *
 * Namespace validation is tricky, because the user has to agree with the system
 * about the letter of the namespace, otherwise there's a risk of data loss. For
 * this reason, validation is strict and throws errors, so that the user can
 * understand and correct their input so that they know the proper form for
 * subsequent uses of the namespace string — especially if they're using the
 * CLI.
 *
 * Silently correcting the namespace would be a bad idea, because the user might
 * not realize that the namespace has been changed, and then they might not be
 * able to find their notes.
 *
 * @throws {Error}
 */
export function validateNamespace(namespace: string, allowAsterisk = false) {
	const errorMessages: string[] = []

	if (namespace.trim().length === 0) {
		errorMessages.push('Cannot be empty')
	}

	if (namespace.trim().length > NOTE_NAMESPACE_MAX_LENGTH) {
		errorMessages.push(`Cannot be longer than ${NOTE_NAMESPACE_MAX_LENGTH} characters`)
	}

	const forbiddenCharacters: Array<[RegExp, string]> = allowAsterisk
		? FORBIDDEN_CHARACTERS
		: [...FORBIDDEN_CHARACTERS, [ASTERISK_REGEX, 'Asterisk']]

	for (const [regex, description] of forbiddenCharacters) {
		const match = namespace.match(regex)
		if (match) {
			const character = JSON.stringify(match[0]).slice(1, -1)
			errorMessages.push(`Forbidden character: ${description}: "${character}"`)
		}
	}

	if (errorMessages.length > 0) {
		throw new Error(`Invalid namespace "${namespace}":\n\t- ${errorMessages.join('\n\t- ')}`)
	}
}

/**
 * Get sanitized namespace with yanki-media- prefix (for ease of searching)
 */
export function getSlugifiedNamespace(namespace: string): string {
	return `yanki-media-${slugify(sanitizeNamespace(namespace)).replaceAll(CONSECUTIVE_HYPHENS_REGEX, '-')}`
}

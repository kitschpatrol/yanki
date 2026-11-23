/* eslint-disable regexp/control-character-escape */
/* eslint-disable no-control-regex */
import slugify from '@sindresorhus/slugify'
import { NOTE_NAMESPACE_MAX_LENGTH } from '../shared/constants'

const CONSECUTIVE_HYPHENS_REGEX = /-+/gu
const ASTERISK_REGEX = /\*/u

// prettier-ignore
const FORBIDDEN_CHARACTERS: Array<[RegExp, string]> = [
	// Yanki-specific forbidden characters
	[/:/u, 'Colon'],
	// ASCII control characters (C0 Controls)
	[/\u{0000}/u, 'Null'],
	[/\u{0001}/u, 'Start of Heading'],
	[/\u{0002}/u, 'Start of Text'],
	[/\u{0003}/u, 'End of Text'],
	[/\u{0004}/u, 'End of Transmission'],
	[/\u{0005}/u, 'Enquiry'],
	[/\u{0006}/u, 'Acknowledge'],
	[/\u{0007}/u, 'Bell'],
	[/\u{0008}/u, 'Backspace'],
	[/\u{0009}/u, 'Horizontal Tab'],
	[/\u{000A}/u, 'Line Feed'],
	[/\u{000B}/u, 'Vertical Tab'],
	[/\u{000C}/u, 'Form Feed'],
	[/\u{000D}/u, 'Carriage Return'],
	[/\u{000E}/u, 'Shift Out'],
	[/\u{000F}/u, 'Shift In'],
	[/\u{0010}/u, 'Data Link Escape'],
	[/\u{0011}/u, 'Device Control 1'],
	[/\u{0012}/u, 'Device Control 2'],
	[/\u{0013}/u, 'Device Control 3'],
	[/\u{0014}/u, 'Device Control 4'],
	[/\u{0015}/u, 'Negative Acknowledge'],
	[/\u{0016}/u, 'Synchronous Idle'],
	[/\u{0017}/u, 'End of Transmission Block'],
	[/\u{0018}/u, 'Cancel'],
	[/\u{0019}/u, 'End of Medium'],
	[/\u{001A}/u, 'Substitute'],
	[/\u{001B}/u, 'Escape'],
	[/\u{001C}/u, 'File Separator'],
	[/\u{001D}/u, 'Group Separator'],
	[/\u{001E}/u, 'Record Separator'],
	[/\u{001F}/u, 'Unit Separator'],
	[/\u{007F}/u, 'Delete'],
	// C1 Controls and Latin-1 Supplement
	[/\u{0080}/u, 'Padding Character'],
	[/\u{0081}/u, 'High Octet Preset'],
	[/\u{0082}/u, 'Break Permitted Here'],
	[/\u{0083}/u, 'No Break Here'],
	[/\u{0084}/u, 'Index'],
	[/\u{0085}/u, 'Next Line'],
	[/\u{0086}/u, 'Start of Selected Area'],
	[/\u{0087}/u, 'End of Selected Area'],
	[/\u{0088}/u, 'Character Tabulation Set'],
	[/\u{0089}/u, 'Character Tabulation with Justification'],
	[/\u{008A}/u, 'Line Tabulation Set'],
	[/\u{008B}/u, 'Partial Line Forward'],
	[/\u{008C}/u, 'Partial Line Backward'],
	[/\u{008D}/u, 'Reverse Line Feed'],
	[/\u{008E}/u, 'Single Shift Two'],
	[/\u{008F}/u, 'Single Shift Three'],
	[/\u{0090}/u, 'Device Control String'],
	[/\u{0091}/u, 'Private Use One'],
	[/\u{0092}/u, 'Private Use Two'],
	[/\u{0093}/u, 'Set Transmit State'],
	[/\u{0094}/u, 'Cancel Character'],
	[/\u{0095}/u, 'Message Waiting'],
	[/\u{0096}/u, 'Start of Protected Area'],
	[/\u{0097}/u, 'End of Protected Area'],
	[/\u{0098}/u, 'Start of String'],
	[/\u{0099}/u, 'Single Graphic Character Introducer'],
	[/\u{009A}/u, 'Single Character Introducer'],
	[/\u{009B}/u, 'Control Sequence Introducer'],
	[/\u{009C}/u, 'String Terminator'],
	[/\u{009D}/u, 'Operating System Command'],
	[/\u{009E}/u, 'Privacy Message'],
	[/\u{009F}/u, 'Application Program Command'],
	[/\u{00A0}/u, 'Non-breaking Space'],
	[/\u{00AD}/u, 'Soft Hyphen'],
	// Additional Unicode non-printable characters
	[/\u{200B}/u, 'Zero-width Space'],
	[/\u{200C}/u, 'Zero-width Non-joiner'],
	[/\u{200D}/u, 'Zero-width Joiner'],
	[/\u{200E}/u, 'Left-to-right Mark'],
	[/\u{200F}/u, 'Right-to-left Mark'],
	[/\u{202A}/u, 'Left-to-right Embedding'],
	[/\u{202B}/u, 'Right-to-left Embedding'],
	[/\u{202C}/u, 'Pop Directional Formatting'],
	[/\u{202D}/u, 'Left-to-right Override'],
	[/\u{202E}/u, 'Right-to-left Override'],
	[/\u{FEFF}/u, 'Byte Order Mark (BOM)'],
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
		if (!match) {
			continue
		}

		const character = JSON.stringify(match[0]).slice(1, -1)
		errorMessages.push(`Forbidden character: ${description}: "${character}"`)
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

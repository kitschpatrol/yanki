/* eslint-disable no-control-regex */
import { NOTE_NAMESPACE_MAX_LENGTH } from '../shared/constants'
import slugify from '@sindresorhus/slugify'

/**
 * Convenience
 * @param namespace
 * @returns sanitized valid namespace
 * @throws If namespace is invalid
 */
export function validateAndSanitizeNamespace(namespace: string, allowAsterisk = false): string {
	validateNamespace(namespace, allowAsterisk)
	return sanitizeNamespace(namespace)
}

/**
 * Used internally before storing and searching
 * @param namespace
 * @returns sanitized namespace
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
 * subsequent uses of the namespace string — especially if they're using the CLI.
 *
 * Silently correcting the namespace would be a bad idea, because the user might
 * not realize that the namespace has been changed, and then they might not be
 * able to find their notes.
 *
 * @param namespace
 * @returns void
 * @throws Error
 */
export function validateNamespace(namespace: string, allowAsterisk = false) {
	const errorMessages: string[] = []

	if (namespace.trim().length === 0) {
		errorMessages.push('Cannot be empty')
	}

	if (namespace.trim().length > NOTE_NAMESPACE_MAX_LENGTH) {
		errorMessages.push(`Cannot be longer than ${NOTE_NAMESPACE_MAX_LENGTH} characters`)
	}

	const forbiddenCharacters: Array<[RegExp, string]> = [
		// Yanki-specific forbidden characters
		[/:/, 'Colon'],
		// ASCII control characters (C0 Controls)
		[/\u0000/, 'Null'],
		[/\u0001/, 'Start of Heading'],
		[/\u0002/, 'Start of Text'],
		[/\u0003/, 'End of Text'],
		[/\u0004/, 'End of Transmission'],
		[/\u0005/, 'Enquiry'],
		[/\u0006/, 'Acknowledge'],
		[/\u0007/, 'Bell'],
		[/\u0008/, 'Backspace'],
		[/\u0009/, 'Horizontal Tab'],
		[/\u000A/, 'Line Feed'],
		[/\u000B/, 'Vertical Tab'],
		[/\u000C/, 'Form Feed'],
		[/\u000D/, 'Carriage Return'],
		[/\u000E/, 'Shift Out'],
		[/\u000F/, 'Shift In'],
		[/\u0010/, 'Data Link Escape'],
		[/\u0011/, 'Device Control 1'],
		[/\u0012/, 'Device Control 2'],
		[/\u0013/, 'Device Control 3'],
		[/\u0014/, 'Device Control 4'],
		[/\u0015/, 'Negative Acknowledge'],
		[/\u0016/, 'Synchronous Idle'],
		[/\u0017/, 'End of Transmission Block'],
		[/\u0018/, 'Cancel'],
		[/\u0019/, 'End of Medium'],
		[/\u001A/, 'Substitute'],
		[/\u001B/, 'Escape'],
		[/\u001C/, 'File Separator'],
		[/\u001D/, 'Group Separator'],
		[/\u001E/, 'Record Separator'],
		[/\u001F/, 'Unit Separator'],
		[/\u007F/, 'Delete'],
		// C1 Controls and Latin-1 Supplement
		[/\u0080/, 'Padding Character'],
		[/\u0081/, 'High Octet Preset'],
		[/\u0082/, 'Break Permitted Here'],
		[/\u0083/, 'No Break Here'],
		[/\u0084/, 'Index'],
		[/\u0085/, 'Next Line'],
		[/\u0086/, 'Start of Selected Area'],
		[/\u0087/, 'End of Selected Area'],
		[/\u0088/, 'Character Tabulation Set'],
		[/\u0089/, 'Character Tabulation with Justification'],
		[/\u008A/, 'Line Tabulation Set'],
		[/\u008B/, 'Partial Line Forward'],
		[/\u008C/, 'Partial Line Backward'],
		[/\u008D/, 'Reverse Line Feed'],
		[/\u008E/, 'Single Shift Two'],
		[/\u008F/, 'Single Shift Three'],
		[/\u0090/, 'Device Control String'],
		[/\u0091/, 'Private Use One'],
		[/\u0092/, 'Private Use Two'],
		[/\u0093/, 'Set Transmit State'],
		[/\u0094/, 'Cancel Character'],
		[/\u0095/, 'Message Waiting'],
		[/\u0096/, 'Start of Protected Area'],
		[/\u0097/, 'End of Protected Area'],
		[/\u0098/, 'Start of String'],
		[/\u0099/, 'Single Graphic Character Introducer'],
		[/\u009A/, 'Single Character Introducer'],
		[/\u009B/, 'Control Sequence Introducer'],
		[/\u009C/, 'String Terminator'],
		[/\u009D/, 'Operating System Command'],
		[/\u009E/, 'Privacy Message'],
		[/\u009F/, 'Application Program Command'],
		[/\u00A0/, 'Non-breaking Space'],
		[/\u00AD/, 'Soft Hyphen'],
		// Additional Unicode non-printable characters
		[/\u200B/, 'Zero-width Space'],
		[/\u200C/, 'Zero-width Non-joiner'],
		[/\u200D/, 'Zero-width Joiner'],
		[/\u200E/, 'Left-to-right Mark'],
		[/\u200F/, 'Right-to-left Mark'],
		[/\u202A/, 'Left-to-right Embedding'],
		[/\u202B/, 'Right-to-left Embedding'],
		[/\u202C/, 'Pop Directional Formatting'],
		[/\u202D/, 'Left-to-right Override'],
		[/\u202E/, 'Right-to-left Override'],
		[/\uFEFF/, 'Byte Order Mark (BOM)'],
	]

	if (!allowAsterisk) {
		// Yanki-specific forbidden characters
		// We push because spread syntax breaks types
		forbiddenCharacters.push([/\*/, 'Asterisk'])
	}

	for (const [regex, description] of forbiddenCharacters) {
		const match = namespace.match(regex)
		if (match) {
			const character = JSON.stringify(match[0]).slice(1, -1)
			errorMessages.push(`Forbidden character: ${description}: "${character}"`)
		}
	}

	if (errorMessages.length > 0) {
		throw new Error(`Invalid namespace provided:\n\t- ${errorMessages.join('\n\t- ')}`)
	}
}

export function getSlugifiedNamespace(namespace: string): string {
	// Always prefix with yanki-media- for ease of searching
	return `yanki-media-${slugify(sanitizeNamespace(namespace)).replaceAll(/-+/g, '-')}`
}

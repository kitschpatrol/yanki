/* eslint-disable unicorn/consistent-function-scoping */
import {
	type Code,
	type Effects,
	type Extension,
	type State,
	type TokenizeContext,
	type TokenTypeMap,
} from 'micromark-util-types'

// Declare module 'micromark-util-types' {
// 	type TokenTypeMap = {
// 		wikiEmbed: 'wikiEmbed'
// 		wikiLabel: 'wikiLabel'
// 		wikiLink: 'wikiLink'
// 		wikiUrl: 'wikiUrl'
// 	}
// }

// Do i need?
// https://www.npmjs.com/package/micromark-util-resolve-all

// Extension name
export function wikiBasic(): Extension {
	return {
		text: {
			// !
			33: {
				name: 'wikiEmbed',
				tokenize: tokenizeWikiRef,
			},
			// [
			91: {
				name: 'wikiLink',
				tokenize: tokenizeWikiRef,
			},
		},
	}

	function tokenizeWikiRef(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
		let isEmbed = false
		let inLabel = false
		let linkLength = 0
		let labelLength = 0

		return bangOrBracket

		function bangOrBracket(code: Code): State | undefined {
			// '!'
			if (code === 33) {
				isEmbed = true
				effects.enter('wikiEmbed' as keyof TokenTypeMap)
				effects.enter('wikiMarker' as keyof TokenTypeMap)
				effects.consume(code)
				return firstOpeningMarker
			}

			effects.enter('wikiLink' as keyof TokenTypeMap)
			effects.enter('wikiMarker' as keyof TokenTypeMap)
			return firstOpeningMarker(code)
		}

		function firstOpeningMarker(code: Code): State | undefined {
			// '['
			if (code === 91) {
				effects.consume(code)
				return secondOpeningMarker
			}

			return nok(code)
		}

		function secondOpeningMarker(code: Code): State | undefined {
			// '['
			if (code === 91) {
				effects.consume(code)
				effects.exit('wikiMarker' as keyof TokenTypeMap)
				return inside
			}

			return nok(code)
		}

		function inside(code: Code): State | undefined {
			// Check for escape '\'
			if (code === 92) {
				effects.consume(code)
				return insideEscape
			}

			// Check for ']'
			if (code === 93) {
				return lookaheadClosingMarker(code)
			}

			// Check for invalid
			if (code === -5 || code === -4 || code === -3 || code === null) {
				return nok(code)
			}

			// Check for '|' label divider
			if (code === 124 && !inLabel) {
				if (linkLength > 0) {
					effects.exit('chunkString')
					effects.exit('wikiUrl' as keyof TokenTypeMap)
				}

				inLabel = true
				effects.enter('wikiLabelMarker' as keyof TokenTypeMap)
				effects.consume(code)
				effects.exit('wikiLabelMarker' as keyof TokenTypeMap)
				return inside
			}

			// Normal character
			// Use great care to avoid creating empty tokens
			if (!inLabel) {
				// First character in URL, start tokens
				if (linkLength === 0) {
					effects.enter('wikiUrl' as keyof TokenTypeMap)
					effects.enter('chunkString', { contentType: 'string' })
				}

				linkLength++
			}

			if (inLabel) {
				// First character in label, start token
				if (labelLength === 0) {
					effects.enter('wikiLabel' as keyof TokenTypeMap)
					effects.enter('chunkString', { contentType: 'string' })
				}

				labelLength++
			}

			effects.consume(code)
			return inside
		}

		function insideEscape(code: Code): State | undefined {
			// '|'
			if (code === 124) {
				effects.consume(code)
				return inside
			}

			return inside(code)
		}

		/**
		 * When encountering a right square bracket, we must look ahead at the next character
		 * to determine whether it indicates the end of the [[wikilink]] or is
		 * simply part of the label text.
		 */
		function lookaheadClosingMarker(code: Code): State | undefined {
			// Invalid
			// ']'
			if (code !== 93) {
				return nok(code)
			}

			// Lookahead
			return effects.check(
				// Check if the next two characters are `]]`
				{ partial: true, tokenize: closingMarkerLookahead },
				// End
				firstClosingMarker,
				// Continue...
				consumeMarker,
			)(code)
		}

		function firstClosingMarker(code: Code): State | undefined {
			// Invalid
			// ']'
			if (code !== 93) {
				console.warn('Invalid use of firstClosingMarker')
				return nok(code)
			}

			if (inLabel && labelLength > 0) {
				effects.exit('chunkString')
				effects.exit('wikiLabel' as keyof TokenTypeMap)
			} else if (!inLabel && linkLength > 0) {
				effects.exit('chunkString')
				effects.exit('wikiUrl' as keyof TokenTypeMap)
			}

			effects.enter('wikiMarker' as keyof TokenTypeMap)
			effects.consume(code)
			return secondClosingMarker
		}

		function secondClosingMarker(code: Code): State | undefined {
			// Invalid
			// ']'
			if (code !== 93) {
				console.warn('Invalid use of secondClosingMarker')
				return nok(code)
			}

			// Empty
			if (linkLength === 0) {
				return nok(code)
			}

			effects.consume(code)

			effects.exit('wikiMarker' as keyof TokenTypeMap)

			if (isEmbed) {
				effects.exit('wikiEmbed' as keyof TokenTypeMap)
			} else {
				effects.exit('wikiLink' as keyof TokenTypeMap)
			}

			return ok
		}

		function consumeMarker(code: Code): State | undefined {
			// Invalid
			// ']'
			if (code !== 93) {
				console.warn('Invalid use of consumeMarker')
				return nok(code)
			}

			effects.consume(code)
			return inside
		}

		/** If the next two characters are `]]`, run `ok`, else `nok`. */
		function closingMarkerLookahead(effects: Effects, ok: State, nok: State): State {
			return start

			function start(code: Code) {
				// ']'
				if (code !== 93) {
					return nok(code)
				}

				effects.enter('wikiMarkerTemp' as keyof TokenTypeMap)
				effects.consume(code)
				effects.exit('wikiMarkerTemp' as keyof TokenTypeMap)
				return lookaheadAt
			}

			function lookaheadAt(code: Code) {
				// ']'
				if (code !== 93) {
					return nok(code)
				}

				effects.enter('wikiMarkerTemp' as keyof TokenTypeMap)
				effects.consume(code)
				effects.exit('wikiMarkerTemp' as keyof TokenTypeMap)
				return ok(code)
			}
		}
	}
}

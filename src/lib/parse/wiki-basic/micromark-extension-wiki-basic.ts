/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable unicorn/consistent-function-scoping */

import {
	type Code,
	type Effects,
	type Extension,
	type State,
	type TokenizeContext,
	type TokenTypeMap,
} from 'micromark-util-types'

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
				return startUrl
			}

			return nok(code)
		}

		function startUrl(code: Code): State | undefined {
			// Check for invalid characters immediately
			if (code === -5 || code === -4 || code === -3 || code === null) {
				return nok(code)
			}

			// Check for pipe character which would be invalid at start
			if (code === 124) {
				return nok(code)
			}

			// Check for closing marker which would create empty link
			if (code === 93) {
				return nok(code)
			}

			// Start URL token
			effects.enter('wikiUrl' as keyof TokenTypeMap)
			effects.enter('chunkString', { contentType: 'string' })

			// Consume first character
			effects.consume(code)
			linkLength++

			return insideUrl
		}

		function insideUrl(code: Code): State | undefined {
			// Check for invalid characters
			if (code === -5 || code === -4 || code === -3 || code === null) {
				return nok(code)
			}

			// Direct pipe transitions to label
			if (code === 124) {
				// Special case if there's no link at this point,
				// e.g. [[\|]]
				if (linkLength === 1) {
					return nok(code)
				}

				return transitionToLabel(code)
			}

			// Backslash - look ahead to check if followed by pipe
			if (code === 92) {
				return effects.check(
					{ partial: true, tokenize: backslashPipeLookahead },
					// If it's \|, transition to label
					transitionToLabel,
					// Otherwise treat backslash as a normal character
					normalUrlChar,
				)(code)
			}

			// Check for closing marker
			if (code === 93) {
				return lookaheadClosingMarker(code)
			}

			// Normal character in URL
			return normalUrlChar(code)
		}

		function normalUrlChar(code: Code): State | undefined {
			// Normal character in URL
			effects.consume(code)
			linkLength++
			return insideUrl
		}

		function startLabel(code: Code): State | undefined {
			// Check for invalid characters immediately
			if (code === -5 || code === -4 || code === -3 || code === null) {
				return nok(code)
			}

			// Check for closing marker which would create empty label
			if (code === 93) {
				return lookaheadClosingMarker(code)
			}

			// Start label token
			effects.enter('wikiLabel' as keyof TokenTypeMap)
			effects.enter('chunkString', { contentType: 'string' })

			// Consume first character
			effects.consume(code)
			labelLength++

			return insideLabel
		}

		function insideLabel(code: Code): State | undefined {
			// Check for invalid characters
			if (code === -5 || code === -4 || code === -3 || code === null) {
				return nok(code)
			}

			// Check for closing marker
			if (code === 93) {
				return lookaheadClosingMarker(code)
			}

			// Backslash is just a normal character in label (not an escape)
			// Every character in label is treated normally
			effects.consume(code)
			labelLength++
			return insideLabel
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
				// Check if the next character is also a `]`
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
				return nok(code)
			}

			// Close any open string tokens
			if (inLabel) {
				// Only exit string and label tokens if we actually entered them
				if (labelLength > 0) {
					effects.exit('chunkString')
					effects.exit('wikiLabel' as keyof TokenTypeMap)
				}
			} else if (linkLength > 0) {
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
				return nok(code)
			}

			// Empty link is invalid
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
				return nok(code)
			}

			// Consume as regular character
			effects.consume(code)

			// If we're in a label, add to label length
			if (inLabel) {
				labelLength++
				return insideLabel
			}

			// Otherwise add to link length
			linkLength++
			return insideUrl
		}

		/** If the next character is also `]`, run `ok`, else `nok`. */
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
				return ok(code)
			}
		}

		/** Check if backslash is followed by pipe. */
		function backslashPipeLookahead(effects: Effects, ok: State, nok: State): State {
			return start

			function start(code: Code) {
				// Backslash (should already be consumed in the temp token)
				if (code !== 92) {
					return nok(code)
				}

				effects.enter('wikiMarkerTemp' as keyof TokenTypeMap)
				effects.consume(code)
				return checkNext
			}

			function checkNext(code: Code) {
				// '|' after backslash
				if (code === 124) {
					effects.consume(code)
					effects.exit('wikiMarkerTemp' as keyof TokenTypeMap)
					return ok(code)
				}

				// Not a pipe after backslash
				effects.exit('wikiMarkerTemp' as keyof TokenTypeMap)
				return nok(code)
			}
		}

		function transitionToLabel(code: Code): State | undefined {
			// Exit current tokens for URL
			effects.exit('chunkString')
			effects.exit('wikiUrl' as keyof TokenTypeMap)

			// Enter marker token
			effects.enter('wikiMarker' as keyof TokenTypeMap)

			// Consume the character (pipe or backslash)
			effects.consume(code)

			// If it's a backslash, we need to continue with consuming the pipe
			if (code === 92) {
				return consumePipeAfterBackslash
			}

			// Otherwise finish the marker
			effects.exit('wikiMarker' as keyof TokenTypeMap)
			inLabel = true

			// Look ahead to check if the next character is a closing bracket
			return effects.check(
				{ partial: true, tokenize: closingBracketLookahead },
				// If it's an immediate closing bracket, skip entering the label tokens
				lookaheadClosingMarker,
				// Otherwise enter label as normal
				startLabel,
			)(code)
		}

		/** Check if next character is a closing bracket. */
		function closingBracketLookahead(effects: Effects, ok: State, nok: State): State {
			return start

			function start(code: Code) {
				// ']'
				if (code === 93) {
					effects.enter('wikiMarkerTemp' as keyof TokenTypeMap)
					effects.consume(code)
					effects.exit('wikiMarkerTemp' as keyof TokenTypeMap)
					return ok(code)
				}

				return nok(code)
			}
		}

		function consumePipeAfterBackslash(code: Code): State | undefined {
			// Must be a pipe
			if (code !== 124) {
				return nok(code)
			}

			// Consume the pipe
			effects.consume(code)
			effects.exit('wikiMarker' as keyof TokenTypeMap)
			inLabel = true
			return startLabel
		}
	}
}

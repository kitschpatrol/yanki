/* eslint-disable unicorn/prefer-string-raw */
/* eslint-disable no-irregular-whitespace */

import { expect, it } from 'vitest'
import { NOTE_NAMESPACE_MAX_LENGTH } from '../src/lib/shared/constants'
import { sanitizeNamespace, validateNamespace } from '../src/lib/utilities/namespace'

it('allows valid namespaces', () => {
	expect(() => {
		validateNamespace('Yanki')
	}).not.toThrow()

	expect(() => {
		validateNamespace('   Yanki ')
	}).not.toThrow()

	expect(() => {
		validateNamespace('ヤンキー')
	}).not.toThrow()

	expect(() => {
		validateNamespace('Yanki 💯')
	}).not.toThrow()

	expect(() => {
		validateNamespace(Array.from({ length: NOTE_NAMESPACE_MAX_LENGTH }, () => 'A').join(''))
	}).not.toThrow()

	expect(() => {
		validateNamespace(
			`   ${Array.from({ length: NOTE_NAMESPACE_MAX_LENGTH }, () => 'A').join('')}   `,
		)
	}).not.toThrow()
})

it('catches invalid namespaces', () => {
	expect(() => {
		validateNamespace('')
	}).toThrowErrorMatchingInlineSnapshot(`
		[Error: Invalid namespace "":
			- Cannot be empty]
	`)
	expect(() => {
		validateNamespace(' ')
	}).toThrowErrorMatchingInlineSnapshot(`
		[Error: Invalid namespace " ":
			- Cannot be empty]
	`)
	expect(() => {
		validateNamespace('    ')
	}).toThrowErrorMatchingInlineSnapshot(`
		[Error: Invalid namespace "    ":
			- Cannot be empty]
	`)
	expect(() => {
		validateNamespace('Wow *')
	}).toThrowErrorMatchingInlineSnapshot(`
		[Error: Invalid namespace "Wow *":
			- Forbidden character: Asterisk: "*"]
	`)
	expect(() => {
		validateNamespace(Array.from({ length: NOTE_NAMESPACE_MAX_LENGTH + 1 }, () => 'A').join(''))
	}).toThrowErrorMatchingInlineSnapshot(`
		[Error: Invalid namespace "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA":
			- Cannot be longer than 60 characters]
	`)
	expect(() => {
		validateNamespace('a\nb')
	}).toThrowErrorMatchingInlineSnapshot(`
		[Error: Invalid namespace "a
		b":
			- Forbidden character: Line Feed: "\\n"]
	`)
	expect(() => {
		validateNamespace('a\tb')
	}).toThrowErrorMatchingInlineSnapshot(`
		[Error: Invalid namespace "a	b":
			- Forbidden character: Horizontal Tab: "\\t"]
	`)
	expect(() => {
		validateNamespace('t\u200Bh\u200Ci\u200Ds contains hidden spaces.')
	}).toThrowErrorMatchingInlineSnapshot(`
		[Error: Invalid namespace "t​h‌i‍s contains hidden spaces.":
			- Forbidden character: Zero-width Space: "​"
			- Forbidden character: Zero-width Non-joiner: "‌"
			- Forbidden character: Zero-width Joiner: "‍"]
	`)
})

it('allows asterisks when asked', () => {
	expect(() => {
		validateNamespace('*', true)
	}).not.toThrow()
})

it('sanitizes inconsistent unicode', () => {
	// Different unicode representations of the same character
	const basicNamespace = 'A basic namespac\u00E9' // Encodes é
	const weirdNamespace = 'a bASic namespac\u0065\u0301' // Encodes é

	expect(basicNamespace.length).not.toEqual(weirdNamespace.length)

	const basicNamespaceSanitized = sanitizeNamespace(basicNamespace)
	const weirdNamespaceSanitized = sanitizeNamespace(weirdNamespace)

	expect(basicNamespaceSanitized.length).toEqual(weirdNamespaceSanitized.length)
	expect(basicNamespaceSanitized.toLowerCase()).toEqual(weirdNamespaceSanitized.toLowerCase())
})

it('sanitizes leading and trailing white space', () => {
	expect(sanitizeNamespace(' bla bla bla  ')).toMatchInlineSnapshot(`"bla bla bla"`)
})

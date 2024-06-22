/* eslint-disable no-irregular-whitespace */
import { yankiMaxNamespaceLength } from '../src/lib/model/constants'
import { sanitizeNamespace, validateNamespace } from '../src/lib/utilities/namespace'
import { expect, it } from 'vitest'

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
		validateNamespace(Array.from({ length: yankiMaxNamespaceLength }, () => 'A').join(''))
	}).not.toThrow()

	expect(() => {
		validateNamespace(
			`   ${Array.from({ length: yankiMaxNamespaceLength }, () => 'A').join('')}   `,
		)
	}).not.toThrow()
})

it('catches invalid namespaces', () => {
	expect(() => {
		validateNamespace('')
	}).toThrowErrorMatchingInlineSnapshot(`
		[Error: Invalid namespace provided:
			- Cannot be empty]
	`)
	expect(() => {
		validateNamespace(' ')
	}).toThrowErrorMatchingInlineSnapshot(`
		[Error: Invalid namespace provided:
			- Cannot be empty]
	`)
	expect(() => {
		validateNamespace('    ')
	}).toThrowErrorMatchingInlineSnapshot(`
		[Error: Invalid namespace provided:
			- Cannot be empty]
	`)
	expect(() => {
		validateNamespace('Wow *')
	}).toThrowErrorMatchingInlineSnapshot(`
		[Error: Invalid namespace provided:
			- Forbidden character: Asterisk: "*"]
	`)
	expect(() => {
		validateNamespace(Array.from({ length: yankiMaxNamespaceLength + 1 }, () => 'A').join(''))
	}).toThrowErrorMatchingInlineSnapshot(`
		[Error: Invalid namespace provided:
			- Cannot be longer than 40 characters]
	`)
	expect(() => {
		validateNamespace('a\nb')
	}).toThrowErrorMatchingInlineSnapshot(`
		[Error: Invalid namespace provided:
			- Forbidden character: Line Feed: "\\n"]
	`)
	expect(() => {
		validateNamespace('a\tb')
	}).toThrowErrorMatchingInlineSnapshot(`
		[Error: Invalid namespace provided:
			- Forbidden character: Horizontal Tab: "\\t"]
	`)
	expect(() => {
		validateNamespace('t\u200Bh\u200Ci\u200Ds contains hidden spaces.')
	}).toThrowErrorMatchingInlineSnapshot(`
		[Error: Invalid namespace provided:
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

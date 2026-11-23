import { expect, it } from 'vitest'
import { urlToHostAndPortValidated } from '../src/bin/utilities/validation'

it('parses a valid AnkiConnect URL', () => {
	const result = urlToHostAndPortValidated('http://localhost:8765')
	expect(result.host).toBe('http://localhost')
	expect(result.port).toBe(8765)
})

it('parses a URL with a different port', () => {
	const result = urlToHostAndPortValidated('http://127.0.0.1:9000')
	expect(result.host).toBe('http://127.0.0.1')
	expect(result.port).toBe(9000)
})

it('parses an https URL with explicit port', () => {
	const result = urlToHostAndPortValidated('https://example.com:8443')
	expect(result.host).toBe('https://example.com')
	expect(result.port).toBe(8443)
})

it('parses an https URL with an explicit default port', () => {
	const result = urlToHostAndPortValidated('https://example.com:443')
	expect(result.host).toBe('https://example.com')
	expect(result.port).toBe(443)
})

it('parses an https URL with an implicit default port', () => {
	const result = urlToHostAndPortValidated('https://example.com')
	expect(result.host).toBe('https://example.com')
	expect(result.port).toBe(443)
})

it('throws for a URL without a resolvable port', () => {
	// Without a protocol, the URL parser treats `example.com:` as the protocol,
	// which has no default port. This must fail validation rather than yielding
	// a NaN port that breaks the AnkiConnect request URL downstream.
	expect(() => urlToHostAndPortValidated('example.com:8765')).toThrowErrorMatchingInlineSnapshot(
		`[Error: Invalid AnkiConnect URL: "example.com:8765"]`,
	)
})

it('throws for an invalid URL', () => {
	expect(() => urlToHostAndPortValidated('not a url')).toThrowErrorMatchingInlineSnapshot(
		`[Error: Invalid AnkiConnect URL: "not a url"]`,
	)
})

it('throws for an empty string', () => {
	expect(() => urlToHostAndPortValidated('')).toThrowErrorMatchingInlineSnapshot(
		`[Error: Invalid AnkiConnect URL: ""]`,
	)
})

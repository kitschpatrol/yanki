import { expect, it } from 'vitest'
import {
	ankiAutoLaunchOption,
	ankiConnectOption,
	ankiWebOption,
	dryRun,
	jsonOption,
	namespaceOption,
	strictLineBreaks,
	verboseOption,
} from '../src/bin/options'

it('has correct ankiAutoLaunchOption defaults', () => {
	expect(ankiAutoLaunchOption['anki-auto-launch'].default).toBe(false)
	expect(ankiAutoLaunchOption['anki-auto-launch'].alias).toBe('l')
	expect(ankiAutoLaunchOption['anki-auto-launch'].type).toBe('boolean')
})

it('has correct ankiWebOption defaults', () => {
	expect(ankiWebOption['anki-web'].default).toBe(true)
	expect(ankiWebOption['anki-web'].alias).toBe('w')
	expect(ankiWebOption['anki-web'].type).toBe('boolean')
})

it('has correct ankiConnectOption defaults', () => {
	expect(ankiConnectOption['anki-connect'].default).toBe('http://127.0.0.1:8765')
	expect(ankiConnectOption['anki-connect'].type).toBe('string')
})

it('has correct verboseOption defaults', () => {
	expect(verboseOption.verbose.default).toBe(false)
	expect(verboseOption.verbose.type).toBe('boolean')
})

it('creates jsonOption with custom description', () => {
	const option = jsonOption('Output as JSON')
	expect(option.json.default).toBe(false)
	expect(option.json.describe).toBe('Output as JSON')
	expect(option.json.type).toBe('boolean')
})

it('has correct dryRun defaults', () => {
	expect(dryRun['dry-run'].default).toBe(false)
	expect(dryRun['dry-run'].alias).toBe('d')
	expect(dryRun['dry-run'].type).toBe('boolean')
})

it('creates namespaceOption with custom description', () => {
	const option = namespaceOption('Set the namespace')
	expect(option.namespace.alias).toBe('n')
	expect(option.namespace.describe).toBe('Set the namespace')
	expect(option.namespace.type).toBe('string')
	expect(option.namespace.default).toBe('Yanki')
})

it('has correct strictLineBreaks defaults', () => {
	expect(strictLineBreaks['strict-line-breaks'].default).toBe(true)
	expect(strictLineBreaks['strict-line-breaks'].alias).toBe('b')
	expect(strictLineBreaks['strict-line-breaks'].type).toBe('boolean')
})

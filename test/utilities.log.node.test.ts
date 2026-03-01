import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import log from '../src/lib/utilities/log'

let spyWarn: MockInstance
let spyError: MockInstance
let spyLog: MockInstance
let spyInfo: MockInstance

beforeEach(() => {
	spyWarn = vi.spyOn(console, 'warn').mockReturnValue()
	spyError = vi.spyOn(console, 'error').mockReturnValue()
	spyLog = vi.spyOn(console, 'log').mockReturnValue()
	spyInfo = vi.spyOn(console, 'info').mockReturnValue()
	log.verbose = false
})

afterEach(() => {
	spyWarn.mockRestore()
	spyError.mockRestore()
	spyLog.mockRestore()
	spyInfo.mockRestore()
	log.verbose = false
})

it('does not log when verbose is false', () => {
	log.log('test message')
	log.info('test info')
	expect(spyWarn).not.toHaveBeenCalled()
	expect(spyLog).not.toHaveBeenCalled()
	expect(spyInfo).not.toHaveBeenCalled()
})

it('logs when verbose is true', () => {
	log.verbose = true
	log.log('test message')
	expect(spyWarn.mock.calls.length + spyLog.mock.calls.length).toBeGreaterThan(0)
})

it('logs info when verbose is true', () => {
	log.verbose = true
	log.info('test info')
	expect(spyWarn.mock.calls.length + spyInfo.mock.calls.length).toBeGreaterThan(0)
})

it('always warns regardless of verbose', () => {
	log.warn('test warning')
	expect(spyWarn).toHaveBeenCalledTimes(1)
})

it('always errors regardless of verbose', () => {
	log.error('test error')
	expect(spyError).toHaveBeenCalledTimes(1)
})

it('prefixes log messages', () => {
	log.verbose = true
	log.logPrefixed('MyPrefix', 'test data')
	// LogPrefixed calls info internally, so it goes to warn (node) or info (browser)
	expect(spyWarn.mock.calls.length + spyInfo.mock.calls.length).toBeGreaterThan(0)
})

it('prefixes info messages', () => {
	log.verbose = true
	log.infoPrefixed('MyPrefix', 'test data')
	expect(spyWarn.mock.calls.length + spyInfo.mock.calls.length).toBeGreaterThan(0)
})

it('prefixes warn messages', () => {
	log.warnPrefixed('MyPrefix', 'warning data')
	expect(spyWarn).toHaveBeenCalled()
})

it('prefixes error messages', () => {
	log.errorPrefixed('MyPrefix', 'error data')
	expect(spyError).toHaveBeenCalled()
})

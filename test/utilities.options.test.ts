import { expect, it } from 'vitest'
import { applyDefaults } from '../src/lib/utilities/options'

type Options = {
	basePath: string | undefined
	filePaths: string[]
	namespace: string
	strict: boolean
}

const defaults: Options = {
	basePath: undefined,
	filePaths: [],
	namespace: 'Default',
	strict: true,
}

it('returns the defaults when there are no options', () => {
	expect(applyDefaults(defaults, undefined)).toEqual(defaults)
	expect(applyDefaults(defaults, {})).toEqual(defaults)
})

it('overrides defaults with the options that are defined', () => {
	expect(applyDefaults(defaults, { namespace: 'Custom', strict: false })).toEqual({
		...defaults,
		namespace: 'Custom',
		strict: false,
	})
})

it('leaves a default in place when its option is undefined', () => {
	const options = { namespace: undefined } as unknown as Partial<Options>
	expect(applyDefaults(defaults, options).namespace).toBe('Default')
})

it('lets a null option override its default', () => {
	// JavaScript callers can pass null where the types only allow undefined
	// eslint-disable-next-line unicorn/no-null
	const options = { basePath: null } as unknown as Partial<Options>
	expect(applyDefaults<Options>({ ...defaults, basePath: '/base' }, options).basePath).toBeNull()
})

it('takes option values by reference instead of copying them', () => {
	const filePaths = ['/vault/a.md', '/vault/b.md']
	expect(applyDefaults(defaults, { filePaths }).filePaths).toBe(filePaths)
})

it('does not modify the defaults', () => {
	const result = applyDefaults(defaults, { namespace: 'Custom' })
	expect(result).not.toBe(defaults)
	expect(defaults.namespace).toBe('Default')
})

import { expect, it } from 'vitest'
import {
	defaultGlobalOptions,
	getDefaultFetchAdapter,
	getDefaultFileAdapter,
} from '../src/lib/shared/types'

it('returns a valid file adapter in node', async () => {
	const adapter = await getDefaultFileAdapter()
	/* eslint-disable ts/unbound-method */
	expect(adapter.readFile).toBeTypeOf('function')
	expect(adapter.readFileBuffer).toBeTypeOf('function')
	expect(adapter.rename).toBeTypeOf('function')
	expect(adapter.stat).toBeTypeOf('function')
	expect(adapter.writeFile).toBeTypeOf('function')
	/* eslint-enable ts/unbound-method */
})

it('file adapter can read a file', async () => {
	const adapter = await getDefaultFileAdapter()
	const content = await adapter.readFile(new URL(import.meta.url).pathname)
	expect(content).toContain('getDefaultFileAdapter')
})

it('file adapter can read a file as buffer', async () => {
	const adapter = await getDefaultFileAdapter()
	const buffer = await adapter.readFileBuffer(new URL(import.meta.url).pathname)
	expect(buffer).toBeInstanceOf(Uint8Array)
	expect(buffer.length).toBeGreaterThan(0)
})

it('file adapter can stat a file', async () => {
	const adapter = await getDefaultFileAdapter()
	const stats = await adapter.stat(new URL(import.meta.url).pathname)
	expect(stats.size).toBeGreaterThan(0)
	expect(stats.mtimeMs).toBeGreaterThan(0)
	expect(stats.ctimeMs).toBeGreaterThan(0)
})

it('returns a valid fetch adapter', () => {
	const adapter = getDefaultFetchAdapter()
	expect(adapter).toBeTypeOf('function')
})

it('has correct default global options', () => {
	expect(defaultGlobalOptions.namespace).toBe('Yanki')
	expect(defaultGlobalOptions.dryRun).toBe(false)
	expect(defaultGlobalOptions.ankiWeb).toBe(false)
	expect(defaultGlobalOptions.strictLineBreaks).toBe(true)
	expect(defaultGlobalOptions.strictMatching).toBe(false)
	expect(defaultGlobalOptions.syncMediaAssets).toBe('local')
	expect(defaultGlobalOptions.manageFilenames).toBe('off')
	expect(defaultGlobalOptions.maxFilenameLength).toBe(60)
	expect(defaultGlobalOptions.checkDatabase).toBe(true)
	expect(defaultGlobalOptions.resolveUrls).toBe(true)
	expect(defaultGlobalOptions.allFilePaths).toEqual([])
	expect(defaultGlobalOptions.basePath).toBeUndefined()
	expect(defaultGlobalOptions.fetchAdapter).toBeUndefined()
	expect(defaultGlobalOptions.fileAdapter).toBeUndefined()
	expect(defaultGlobalOptions.obsidianVault).toBeUndefined()
})

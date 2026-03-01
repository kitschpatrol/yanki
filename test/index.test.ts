import { expect, it } from 'vitest'
import * as yanki from '../src/lib/index'

it('exports all expected action functions', () => {
	expect(yanki.cleanNotes).toBeTypeOf('function')
	expect(yanki.listNotes).toBeTypeOf('function')
	expect(yanki.renameFiles).toBeTypeOf('function')
	expect(yanki.getStyle).toBeTypeOf('function')
	expect(yanki.setStyle).toBeTypeOf('function')
	expect(yanki.syncFiles).toBeTypeOf('function')
	expect(yanki.syncNotes).toBeTypeOf('function')
})

it('exports parse functions', () => {
	expect(yanki.getNoteFromMarkdown).toBeTypeOf('function')
})

it('exports URL utility functions', () => {
	expect(yanki.hostAndPortToUrl).toBeTypeOf('function')
	expect(yanki.urlToHostAndPort).toBeTypeOf('function')
})

it('exports default option objects', () => {
	expect(yanki.defaultCleanOptions).toBeDefined()
	expect(yanki.defaultListOptions).toBeDefined()
	expect(yanki.defaultRenameFilesOptions).toBeDefined()
	expect(yanki.defaultGetStyleOptions).toBeDefined()
	expect(yanki.defaultSetStyleOptions).toBeDefined()
	expect(yanki.defaultSyncFilesOptions).toBeDefined()
	expect(yanki.defaultSyncNotesOptions).toBeDefined()
	expect(yanki.defaultGetNoteFromMarkdownOptions).toBeDefined()
})

it('exports format functions', () => {
	expect(yanki.formatCleanResult).toBeTypeOf('function')
	expect(yanki.formatListResult).toBeTypeOf('function')
	expect(yanki.formatSetStyleResult).toBeTypeOf('function')
	expect(yanki.formatSyncFilesResult).toBeTypeOf('function')
})

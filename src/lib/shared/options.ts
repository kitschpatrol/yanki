import { environment } from '../utilities/platform'
import path from 'path-browserify-esm'
import { type YankiConnectOptions, defaultYankiConnectOptions } from 'yanki-connect'

export type ManageFilenames = 'off' | 'prompt' | 'response'
export type SyncMediaAssets = 'all' | 'local' | 'none' | 'remote'
export type FileFunctions = {
	readFile: (filePath: string, encoding?: 'utf8') => Promise<string>
	rename: (oldPath: string, newPath: string) => Promise<void>
	writeFile: (filePath: string, data: string, encoding?: 'utf8') => Promise<void> // Not used, yet
}

// Options used in more than one place... diamond problem prevents a pure hierarchy
export type GlobalOptions = {
	ankiConnectOptions: YankiConnectOptions
	/**
	 * Automatically sync any changes to AnkiWeb after Yanki has finished syncing
	 * locally. If false, only local Anki data is updated and you must manually
	 * invoke a sync to AnkiWeb. This is the equivalent of pushing the "sync"
	 * button in the Anki app.
	 */
	ankiWeb: boolean
	cwd: string
	dryRun: boolean
	fileFunctions: FileFunctions | undefined
	manageFilenames: ManageFilenames
	/** Only applies if manageFilenames is `true`. Will _not_ truncate user-specified file names in other cases. */
	maxFilenameLength: number
	namespace: string
	/** Ensures that wiki-style links work correctly */
	obsidianVault: string | undefined
	/** Sync image, video, and audio assets to Anki's media storage system */
	syncMediaAssets: SyncMediaAssets
	/**
	 * Whether to require changes to notes, models, or decks before invoking an
	 * AnkiWeb sync. Seems like a good idea, but this is tricky... because if you
	 * change the AnkiWeb flag after doing a sync, and haven't changed any files,
	 * you won't end up pushing changes to AnkiWeb, which seems to contradict
	 * expectations even though it would be more performant in the typical case.
	 *
	 * Still requires the AnkiWeb flag to be true.
	 * */
	syncToAnkiWebEvenIfUnchanged: boolean
}

export const defaultGlobalOptions: GlobalOptions = {
	ankiConnectOptions: defaultYankiConnectOptions,
	ankiWeb: false,
	cwd: path.process_cwd,
	dryRun: false,
	fileFunctions: undefined, // Must be passed in later, deepmerge will not work
	manageFilenames: 'off',
	maxFilenameLength: 60,
	namespace: 'Yanki',
	obsidianVault: undefined,
	syncMediaAssets: 'local',
	syncToAnkiWebEvenIfUnchanged: true,
}

// Helpers ---------------------------

const fs =
	environment === 'node' ? ((await import('node:fs/promises')) as FileFunctions) : undefined

export function getDefaultFileFunctions(): FileFunctions {
	if (environment === 'node') {
		if (fs === undefined) {
			throw new Error('Issue loading file functions in Node environment')
		}

		return {
			async readFile(filePath) {
				return fs.readFile(filePath, 'utf8')
			},
			async rename(oldPath, newPath) {
				return fs.rename(oldPath, newPath)
			},
			async writeFile(filePath, data) {
				return fs.writeFile(filePath, data, 'utf8')
			},
		}
	}

	throw new Error(
		'The "readFile", "writeFile", and "rename" file function implementations must be provided to the function when running in the browser',
	)
}

import { ENVIRONMENT } from '../utilities/platform'
import path from 'path-browserify-esm'
import {
	type YankiConnectOptions,
	type YankiFetchAdapter,
	defaultYankiConnectOptions,
} from 'yanki-connect'

export type FetchAdapter = YankiFetchAdapter
export type ManageFilenames = 'off' | 'prompt' | 'response'
export type SyncMediaAssets = 'all' | 'local' | 'off' | 'remote'

export type FileAdapter = {
	readFile(filePath: string): Promise<string>
	// Simpler than making the user implement overloads
	readFileBuffer(filePath: string): Promise<Uint8Array>
	rename(oldPath: string, newPath: string): Promise<void>
	stat(filePath: string): Promise<{
		// Require only the fields we can also get in Obsidian
		ctimeMs: number // Time of creation, represented as a unix timestamp, in milliseconds.
		mtimeMs: number // Time of last modification, represented as a unix timestamp, in milliseconds.
		size: number // Size on disk, as bytes.
	}>
	writeFile(filePath: string, data: string): Promise<void> // Not used, yet
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
	/** Override where "/" should resolve to... useful in Obsidian to set the vault path as the "root" */
	basePath: string | undefined
	cwd: string
	dryRun: boolean
	/**
	 * Exposed for Obsidian, currently only used for getting URL content hashes
	 * and inferring MIME types of URLs without extensions.
	 * Note that ankiConnectOptions ALSO has a fetch adapter option specifically
	 * for communicating with Anki-Connect.
	 */
	fetchAdapter: FetchAdapter | undefined
	fileAdapter: FileAdapter | undefined
	manageFilenames: ManageFilenames
	/** Only applies if manageFilenames is `true`. Will _not_ truncate user-specified file names in other cases. */
	maxFilenameLength: number
	namespace: string
	/** Ensures that wiki-style links work correctly */
	obsidianVault: string | undefined
	/** Sync image, video, and audio assets to Anki's media storage system */
	syncMediaAssets: SyncMediaAssets
}

export const defaultGlobalOptions: GlobalOptions = {
	ankiConnectOptions: defaultYankiConnectOptions,
	ankiWeb: false,
	basePath: undefined,
	cwd: path.process_cwd,
	dryRun: false,
	fetchAdapter: undefined, // Must be passed in later, deepmerge will not work
	fileAdapter: undefined, // Must be passed in later, deepmerge will not work
	manageFilenames: 'off',
	maxFilenameLength: 60,
	namespace: 'Yanki',
	obsidianVault: undefined,
	syncMediaAssets: 'local',
}

// Helpers ---------------------------

export async function getDefaultFileAdapter(): Promise<FileAdapter> {
	if (ENVIRONMENT === 'node') {
		// TODO memoize
		const nodeFs = await import('node:fs/promises')
		if (nodeFs === undefined) {
			throw new Error('Error loading file functions in Node environment')
		}

		return {
			async readFile(filePath: string): Promise<string> {
				return nodeFs.readFile(filePath, 'utf8')
			},

			async readFileBuffer(filePath: string): Promise<Uint8Array> {
				return nodeFs.readFile(filePath)
			},

			async rename(oldPath: string, newPath: string): Promise<void> {
				await nodeFs.rename(oldPath, newPath)
			},

			async stat(filePath) {
				return nodeFs.stat(filePath)
			},

			async writeFile(filePath: string, data: string): Promise<void> {
				await nodeFs.writeFile(filePath, data, 'utf8')
			},
		}
	}

	throw new Error(
		'The "readFile", "readFileBuffer", "rename" , "stat", and "writeFile" function implementations must be provided to the function when running in the browser',
	)
}

export function getDefaultFetchAdapter(): FetchAdapter {
	// eslint-disable-next-line n/no-unsupported-features/node-builtins
	return fetch.bind(globalThis)
}

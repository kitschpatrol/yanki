// Node-only helpers for CLI

// Obsidian global settings:
// https://help.obsidian.md/Files+and+folders/How+Obsidian+stores+data#Global+settings

import fs from 'node:fs/promises'
import path from 'node:path'
import untildify from 'untildify'
import { normalize } from '../../lib/utilities/path'
import { PLATFORM } from '../../lib/utilities/platform'

type ObsidianVault = {
	directory: string
	id: string
	name: string
}

function getObsidianGlobalSettingsDirectory(): string {
	switch (PLATFORM) {
		case 'linux': {
			return normalize(path.join(untildify(process.env.XDG_CONFIG_HOME ?? '~/.config'), 'Obsidian'))
		}

		case 'mac': {
			return normalize(untildify('~/Library/Application Support/obsidian'))
		}

		case 'other': {
			throw new Error('Unsupported platform')
		}

		case 'windows': {
			return normalize(`${process.env.APPDATA}\\Obsidian`)
		}
	}
}

async function getObsidianVaults(): Promise<ObsidianVault[]> {
	const obsidianConfigFilePath = path.join(getObsidianGlobalSettingsDirectory(), 'obsidian.json')

	// Check if path exists
	try {
		await fs.access(obsidianConfigFilePath)
	} catch {
		return []
	}

	const obsidianConfig = JSON.parse(await fs.readFile(obsidianConfigFilePath, 'utf8')) as {
		vaults?: Record<string, { path: string }>
	}

	if (obsidianConfig.vaults === undefined) {
		return []
	}

	return Object.entries(obsidianConfig.vaults).map(([id, { path: directory }]) => ({
		directory,
		id,
		name: path.basename(directory),
	}))
}

/**
 * Assumes the vault has been opened at least once.
 * Searches up.
 */
export async function detectVault(fileOrDirectoryPath: string): Promise<ObsidianVault | undefined> {
	const obsidianVaults = await getObsidianVaults()

	if (obsidianVaults.length === 0) {
		return undefined
	}

	const normalizedPath = path.resolve(normalize(untildify(fileOrDirectoryPath)))

	// Check if directory
	const stats = await fs.stat(normalizedPath)

	const normalizedDirectoryPath = stats.isDirectory()
		? normalizedPath
		: path.dirname(normalizedPath)

	for (const vault of obsidianVaults) {
		const vaultDirectory = path.resolve(normalize(vault.directory))
		if (normalizedDirectoryPath.startsWith(vaultDirectory)) {
			return vault
		}
	}

	return undefined
}

// /**
//  * Primarily for testing.
//  * Node-only.
//  */
// export function openVault()

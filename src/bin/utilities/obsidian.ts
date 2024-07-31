// Node-only helpers for CLI

// Obsidian global settings:
// https://help.obsidian.md/Files+and+folders/How+Obsidian+stores+data#Global+settings

import { PLATFORM } from '../../lib/utilities/platform'
import convertPath from '@stdlib/utils-convert-path'
import fs from 'node:fs/promises'
import path from 'node:path'
import untildify from 'untildify'

export type ObsidianVault = {
	directory: string
	id: string
	name: string
}

function getObsidianGlobalSettingsDirectory(): string {
	switch (PLATFORM) {
		case 'mac': {
			return untildify('~/Library/Application Support/obsidian')
		}

		case 'windows': {
			return convertPath(`${process.env.APPDATA}\\Obsidian`, 'mixed')
		}

		case 'linux': {
			return path.posix.join(untildify(process.env.XDG_CONFIG_HOME ?? '~/.config'), 'Obsidian')
		}

		case 'other': {
			throw new Error('Unsupported platform')
		}
	}
}

async function getObsidianVaults(): Promise<ObsidianVault[]> {
	const obsidianConfigFilePath = path.posix.join(
		getObsidianGlobalSettingsDirectory(),
		'obsidian.json',
	)

	console.log(`obsidianConfigFilePath: ${obsidianConfigFilePath}`)

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
		name: path.posix.basename(directory),
	}))
}

/**
 * Assumes the vault has been opened at least once.
 * Searches up.
 */
export async function detectVault(fileOrDirectoryPath: string): Promise<ObsidianVault | undefined> {
	const obsidianVaults = await getObsidianVaults()

	console.log(`obsidianVaults: ${String(obsidianVaults)}`)

	if (obsidianVaults.length === 0) {
		return undefined
	}

	const normalizedPath = path.posix.resolve(path.posix.normalize(untildify(fileOrDirectoryPath)))

	// Check if directory
	const stats = await fs.stat(normalizedPath)

	const normalizedDirectoryPath = stats.isDirectory()
		? normalizedPath
		: path.posix.dirname(normalizedPath)

	for (const vault of obsidianVaults) {
		const vaultDirectory = path.posix.resolve(path.posix.normalize(vault.directory))
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

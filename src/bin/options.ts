import { defaultGlobalOptions } from '../lib/shared/options'
import { type Options } from 'yargs'

export const ankiAutoLaunchOption = {
	'anki-auto-launch': {
		alias: 'l',
		default: false,
		describe:
			"Attempt to open the Anki desktop app if it's not already running. (Experimental, macOS only.)",
		type: 'boolean',
	},
} as const satisfies Record<string, Options>

export const ankiWebOption = {
	'anki-web': {
		alias: 'w',
		default: true, // Overrides library default!
		describe:
			'Automatically sync any changes to AnkiWeb after Yanki has finished syncing locally. If false, only local Anki data is updated and you must manually invoke a sync to AnkiWeb. This is the equivalent of pushing the "sync" button in the Anki app.',
		type: 'boolean',
	},
} as const satisfies Record<string, Options>

export const ankiConnectOption = {
	'anki-connect': {
		default: 'http://127.0.0.1:8765',
		describe:
			'Host and port of the Anki-Connect server. The default is usually fine. See the Anki-Connect documentation for more information.',
		type: 'string',
	},
} as const satisfies Record<string, Options>

export const verboseOption = {
	verbose: {
		default: false,
		describe: 'Enable verbose logging.',
		type: 'boolean',
	},
} as const satisfies Record<string, Options>

export function jsonOption(describe: string) {
	return {
		json: {
			default: false,
			describe,
			type: 'boolean',
		},
	} as const satisfies Record<string, Options>
}

export const dryRun = {
	'dry-run': {
		alias: 'd',
		default: false,
		describe:
			'Run without making any changes to the Anki database. See a report of what would have been done.',
		type: 'boolean',
	},
} as const satisfies Record<string, Options>

export function namespaceOption(describe: string) {
	return {
		namespace: {
			alias: 'n',
			default: defaultGlobalOptions.namespace,
			describe,
			type: 'string',
		},
	} as const satisfies Record<string, Options>
}

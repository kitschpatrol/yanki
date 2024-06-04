import { yankiDefaultNamespace } from '../lib/model/constants'
import { type Options } from 'yargs'

export const ankiAutoLaunchOption = {
	'anki-auto-launch': {
		default: false,
		describe:
			"Attempt to open the desktop Anki.app if it's not already running. (Experimental, macOS only.)",
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
			default: yankiDefaultNamespace,
			describe,
			type: 'string',
		},
	} as const satisfies Record<string, Options>
}

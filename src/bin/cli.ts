import { globby } from 'globby'
import fs from 'node:fs/promises'
import path from 'node:path'
import untildify from 'untildify'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { version } from '../../package.json'
import { cleanNotes, formatCleanResult } from '../lib/actions/clean'
import { formatListResult, listNotes } from '../lib/actions/list'
import { formatSetStyleResult, setStyle } from '../lib/actions/style'
import { formatSyncFilesResult, syncFiles } from '../lib/actions/sync-files'
import { defaultGlobalOptions } from '../lib/shared/types'
import log from '../lib/utilities/log'
import { normalize } from '../lib/utilities/path'
import {
	ankiAutoLaunchOption,
	ankiConnectOption,
	ankiWebOption,
	dryRun,
	jsonOption,
	namespaceOption,
	strictLineBreaks,
	verboseOption,
} from './options'
import { urlToHostAndPortValidated } from './utilities/validation'

// Helper for nice errors in the most common case where Anki is not running
// Must be constant function expression to help TS infer that it exits
const ankiNotRunningErrorHandler = (error: unknown) => {
	if (error instanceof Error) {
		// Destructuring here can throws runtime errors if code is undefined...
		const code = (error.cause as { code?: string })?.code

		if (code === 'ECONNREFUSED') {
			log.error(
				'Failed to connect to Anki. Make sure Anki is running and AnkiConnect is installed.',
			)
			process.exitCode = 1
			// eslint-disable-next-line unicorn/no-process-exit
			process.exit()
		}

		throw error
	}

	throw new Error('Unknown error')
}

const yargsInstance = yargs(hideBin(process.argv))

await yargsInstance
	.scriptName('yanki')
	.usage('$0 [command]', 'Run a Yanki command. Defaults to `sync` if a command is not provided.')
	// `yanki sync` (default)
	.command(
		['$0 <directory> [options]', 'sync <directory> [options]'],
		'Perform a one-way synchronization from a local directory of Markdown files to the Anki database. Any Markdown files in subdirectories are included as well.',
		(yargs) =>
			yargs
				.positional('directory', {
					demandOption: true,
					describe: 'The path to the local directory of Markdown files to sync.',
					type: 'string',
				})
				// Use recursive by default
				// .option('recursive', {
				// 	alias: 'r',
				// 	describe: 'Include Markdown files in subdirectories of <directory>.',
				// 	type: 'boolean',
				// })
				.option(dryRun)
				.option(
					namespaceOption(
						'Advanced option for managing multiple Yanki synchronization groups. Case insensitive. See the readme for more information.',
					),
				)
				.option(ankiConnectOption)
				.option(ankiAutoLaunchOption)
				.option(ankiWebOption)
				.option('manage-filenames', {
					alias: 'm',
					choices: ['off', 'prompt', 'response'] as const,
					default: defaultGlobalOptions.manageFilenames,
					describe:
						'Rename local note files to match their content. Useful if you want to feel have semantically reasonable note file names without managing them by hand. The `"prompt"` option will attempt to create the filename based on the "front" of the card, while `"response"` will prioritize the "back", "Cloze", or "type in the answer" portions of the card. Truncation, sanitization, and deduplication are taken care of.',
					type: 'string',
				})
				.option('max-filename-length', {
					// Default to undefined for more informative validation if manage-filenames is not enabled
					default: undefined,
					defaultDescription: String(defaultGlobalOptions.maxFilenameLength),
					describe:
						'If `manage-filenames` is enabled, this option specifies the maximum length of the filename in characters.',
					type: 'number',
				})
				.option('sync-media', {
					alias: 's',
					choices: ['off', 'all', 'local', 'remote'] as const,
					default: defaultGlobalOptions.syncMediaAssets,
					describe:
						"Sync image, video, and audio assets to Anki's media storage system. Clean up is managed automatically. The `all` argument will save both local and remote assets to Anki, while `local` will only save local assets, `remote` will only save remote assets, and `off` will not save any assets.",
					type: 'string',
				})
				.option('strict-matching', {
					default: defaultGlobalOptions.strictMatching,
					describe:
						'Consider notes to be a "match" only if the local Markdown frontmatter `noteId` matches the remote Anki database `noteId` exactly. When disabled, Yanki will attempt to reuse existing Anki notes whose content matches a local Markdown note, even if the local and remote `noteId` differs. This helps preserve study progress in Anki if the local Markdown frontmatter is lost or corrupted. In Yanki 0.17.0 and earlier, `--strict-matching` was the default behavior. Starting with version 0.18.0, it is disabled by default and may be enabled via this flag.',
					type: 'boolean',
				})
				.option(strictLineBreaks)
				.option(jsonOption('Output the sync report as JSON.'))
				.option(verboseOption),
		async ({
			ankiAutoLaunch,
			ankiConnect,
			ankiWeb,
			directory,
			dryRun,
			json,
			manageFilenames,
			maxFilenameLength,
			namespace,
			// Not exposing this option for now
			recursive = true,
			strictMatching,
			syncMedia,
			verbose,
		}) => {
			log.verbose = verbose
			const expandedDirectory = normalize(untildify(directory))
			const globPattern = recursive ? `${expandedDirectory}/**/*.md` : `${expandedDirectory}/*.md`
			const markdownFilePathsRaw = await globby(globPattern, { absolute: true })
			const markdownFilePaths = markdownFilePathsRaw.map((path) => normalize(path))

			// Get a list of all files for name-only wiki link resolution
			const allFilePathsRaw = await globby(`${expandedDirectory}/**/*`, { absolute: true })
			const allFilePaths = allFilePathsRaw.map((path) => normalize(path))

			if (markdownFilePaths.length === 0) {
				log.error(`No Markdown files found in "${directory}".`)
				process.exitCode = 1
				return
			}

			if (manageFilenames === 'off' && maxFilenameLength !== undefined) {
				log.warn('Ignoring `max-filename-length` option because `manage-filenames` is not enabled.')
			}

			const { host, port } = urlToHostAndPortValidated(ankiConnect)

			const result = await syncFiles(markdownFilePaths, {
				allFilePaths,
				ankiConnectOptions: {
					autoLaunch: ankiAutoLaunch,
					host,
					port,
				},
				ankiWeb,
				dryRun,
				manageFilenames,
				maxFilenameLength,
				namespace,
				strictMatching,
				syncMediaAssets: syncMedia,
			}).catch(ankiNotRunningErrorHandler)

			if (json) {
				process.stdout.write(JSON.stringify(result, undefined, 2))
				process.stdout.write('\n')
			} else {
				process.stderr.write(formatSyncFilesResult(result, verbose))
				process.stderr.write('\n')
			}
		},
	)
	// `yanki list`
	.command(
		'list [options]',
		'Utility command to list Yanki-created notes in the Anki database.',
		(yargs) =>
			yargs
				.option(
					namespaceOption(
						"Advanced option to list notes in a specific namespace. Case insensitive. Notes from the default internal namespace are listed by default. Pass `'*'` to list all Yanki-created notes in the Anki database.",
					),
				)
				.options(ankiConnectOption)
				.options(ankiAutoLaunchOption)
				.option(jsonOption('Output the list of notes as JSON to stdout.')),
		async ({ ankiAutoLaunch, ankiConnect, json, namespace }) => {
			const { host, port } = urlToHostAndPortValidated(ankiConnect)

			const result = await listNotes({
				ankiConnectOptions: {
					autoLaunch: ankiAutoLaunch,
					host,
					port,
				},
				namespace,
			}).catch(ankiNotRunningErrorHandler)

			if (json) {
				process.stdout.write(JSON.stringify(result, undefined, 2))
				process.stdout.write('\n')
			} else {
				process.stdout.write(formatListResult(result))
				process.stdout.write('\n')
			}
		},
	)
	// `yanki delete`
	.command(
		'delete [options]',
		"Utility command to manually delete Yanki-created notes in the Anki database. This is for advanced use cases, usually the `sync` command takes care of deleting files from Anki Database once they're removed from the local file system.",
		(yargs) =>
			yargs
				.option(dryRun)
				.option(
					namespaceOption(
						"Advanced option to list notes in a specific namespace. Case insensitive. Notes from the default internal namespace are listed by default. If you've synced notes to multiple namespaces, Pass `'*'` to delete all Yanki-created notes in the Anki database.",
					),
				)
				.options(ankiConnectOption)
				.options(ankiAutoLaunchOption)
				.option(ankiWebOption)
				.option(jsonOption('Output the list of deleted notes as JSON to stdout.'))
				.option(verboseOption),
		async ({ ankiAutoLaunch, ankiConnect, ankiWeb, dryRun, json, namespace, verbose }) => {
			const { host, port } = urlToHostAndPortValidated(ankiConnect)

			const result = await cleanNotes({
				ankiConnectOptions: {
					autoLaunch: ankiAutoLaunch,
					host,
					port,
				},
				ankiWeb,
				dryRun,
				namespace,
			}).catch(ankiNotRunningErrorHandler)

			if (json) {
				process.stdout.write(JSON.stringify(result, undefined, 2))
				process.stdout.write('\n')
			} else {
				process.stderr.write(formatCleanResult(result, verbose))
				process.stderr.write('\n')
			}
		},
	)
	// `yanki style`
	.command(
		'style [options]',
		'Utility command to set the CSS stylesheet for all present and future Yanki-created notes.',
		(yargs) =>
			yargs
				.option(dryRun)
				.option('css', {
					alias: 'c',
					default: undefined,
					describe:
						'Path to the CSS stylesheet to set for all Yanki-created notes. If not provided, the default Anki stylesheet is used.',
					type: 'string',
				})
				.options(ankiConnectOption)
				.options(ankiAutoLaunchOption)
				.option(ankiWebOption)
				.option(jsonOption('Output the list of updated note types / models as JSON to stdout.'))
				.option(verboseOption),
		async ({ ankiAutoLaunch, ankiConnect, ankiWeb, css, dryRun, json, verbose }) => {
			const { host, port } = urlToHostAndPortValidated(ankiConnect)

			let loadedCss: string | undefined
			if (css !== undefined) {
				if (path.extname(css) !== '.css') {
					log.error('The provided CSS file must have a .css extension.')
					process.exitCode = 1
					return
				}

				try {
					loadedCss = await fs.readFile(css, 'utf8')
				} catch (error) {
					if (error instanceof Error) {
						log.error(`Error loading CSS file: ${error.message}`)
					} else {
						log.error(`Unknown error loading CSS file: ${String(error)}`)
					}

					process.exitCode = 1
					return
				}
			}

			const result = await setStyle({
				ankiConnectOptions: {
					autoLaunch: ankiAutoLaunch,
					host,
					port,
				},
				ankiWeb,
				css: loadedCss ?? undefined,
				dryRun,
			}).catch(ankiNotRunningErrorHandler)

			if (json) {
				process.stdout.write(JSON.stringify(result, undefined, 2))
				process.stdout.write('\n')
			} else {
				process.stderr.write(formatSetStyleResult(result, verbose))
				process.stderr.write('\n')
			}
		},
	)
	.demandCommand(1)
	.alias('h', 'help')
	.version(version)
	.alias('v', 'version')
	.help()
	.wrap(process.stdout.isTTY ? Math.min(120, yargsInstance.terminalWidth()) : 0)
	.parse()

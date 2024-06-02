import { cleanNotes, formatCleanReport } from '../lib/sync/clean'
import { formatListReport, listNotes } from '../lib/sync/list'
import { formatSyncReport, syncFiles } from '../lib/sync/sync'
import log from '../lib/utilities/log'
import { urlToHostAndPort } from '../lib/utilities/string'
import {
	ankiAutoLaunchOption,
	ankiConnectOption,
	dryRun,
	jsonOption,
	namespaceOption,
	verboseOption,
} from './options'
import { globby } from 'globby'
import untildify from 'untildify'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

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
				.option(jsonOption('Output the sync report as JSON.'))
				.option(verboseOption),
		async ({
			ankiAutoLaunch,
			ankiConnect,
			directory,
			dryRun,
			json,
			namespace,
			// Not exposing this option for now
			recursive = true,
			verbose,
		}) => {
			log.verbose = verbose
			const expandedDirectory = untildify(directory)
			const globPattern = recursive ? `${expandedDirectory}/**/*.md` : `${expandedDirectory}/*.md`
			const paths = await globby(globPattern, { absolute: true })

			if (paths.length === 0) {
				log.error(`No Markdown files found in "${expandedDirectory}".`)
				process.exitCode = 1
				return
			}

			const { host, port } = urlToHostAndPort(ankiConnect)

			const report = await syncFiles(paths, {
				ankiConnectOptions: {
					autoLaunch: ankiAutoLaunch,
					host,
					port,
				},
				dryRun,
				namespace,
			})

			if (json) {
				process.stdout.write(JSON.stringify(report, undefined, 2))
				process.stdout.write('\n')
			} else {
				process.stderr.write(formatSyncReport(report, verbose))
				process.stderr.write('\n')
			}
		},
	)
	// `yanki list`
	.command(
		'list',
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
			const { host, port } = urlToHostAndPort(ankiConnect)

			const result = await listNotes({
				ankiConnectOptions: {
					autoLaunch: ankiAutoLaunch,
					host,
					port,
				},
				namespace,
			})

			if (json) {
				process.stdout.write(JSON.stringify(result, undefined, 2))
				process.stdout.write('\n')
			} else {
				process.stdout.write(formatListReport(result))
				process.stdout.write('\n')
			}
		},
	)
	// `yanki delete`
	.command(
		'delete',
		"Utility command to manually delete Yanki-created notes in the Anki database. This is for advanced use cases, usually the `sync` command takes care of deleting files from Anki Database once they're removed from the local file system.",
		(yargs) =>
			yargs
				.option(dryRun)
				.option(
					namespaceOption(
						"Advanced option to list notes in a specific namespace. Case insensitive. Notes from the default internal namespace are listed by default. Pass `'*'` to delete all Yanki-created notes in the Anki database.",
					),
				)
				.options(ankiConnectOption)
				.options(ankiAutoLaunchOption)
				.option(jsonOption('Output the list of deleted notes as JSON to stdout.'))
				.option(verboseOption),
		async ({ ankiAutoLaunch, ankiConnect, dryRun, json, namespace, verbose }) => {
			const { host, port } = urlToHostAndPort(ankiConnect)

			const report = await cleanNotes({
				ankiConnectOptions: {
					autoLaunch: ankiAutoLaunch,
					host,
					port,
				},
				dryRun,
				namespace,
			})

			if (json) {
				process.stdout.write(JSON.stringify(report, undefined, 2))
				process.stdout.write('\n')
			} else {
				process.stderr.write(formatCleanReport(report, verbose))
				process.stderr.write('\n')
			}
		},
	)
	.demandCommand(1)
	.alias('h', 'help')
	.version()
	.alias('v', 'version')
	.help()
	.wrap(process.stdout.isTTY ? Math.min(120, yargsInstance.terminalWidth()) : 0)
	.parse()

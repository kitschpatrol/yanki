#!/usr/bin/env node

import { syncFiles } from '../lib/sync/sync'
import log from '../lib/utilities/log'
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
		'Perform a one-way synchronization of a local directory of Markdown files to Anki.',
		(yargs) =>
			yargs
				.positional('directory', {
					demandOption: true,
					describe: 'The path to the local directory of Markdown files to sync.',
					type: 'string',
				})
				.option('recursive', {
					alias: 'r',
					describe: 'Include Markdown files in subdirectories of <directory>.',
					type: 'boolean',
				})
				.option('dry-run', {
					alias: 'd',
					default: false,
					describe:
						'Run the synchronization without making any changes. See a report of what would have been done.',
					type: 'boolean',
				})
				.option('namespace', {
					alias: 'n',
					default: 'Yanki CLI',
					describe:
						'Advanced option for managing multiple Yanki synchronization groups. Case insensitive. See the readme for more information.',
					type: 'string',
				})
				.option('anki-connect-host', {
					default: 'http://127.0.0.1:8765',
					describe:
						'Host and port of the Anki-Connect server. The default is usually fine. See the Anki-Connect documentation for more information.',
					type: 'string',
				})
				.option('anki-auto-launch', {
					default: false,
					describe:
						"Attempt to open the desktop Anki.app if it's not already running. (Experimental, macOS only.)",
					type: 'boolean',
				})
				.option('json', {
					default: false,
					describe: 'Output the sync report as JSON.',
					type: 'boolean',
				})
				.option('verbose', {
					default: false,
					describe:
						'Enable verbose logging. All verbose logs and prefixed with their log level and are printed to `stderr` for ease of redirection.',
					type: 'boolean',
				}),
		async ({
			ankiAutoLaunch,
			ankiConnectHost,
			directory,
			dryRun,
			json,
			namespace,
			recursive,
			verbose,
		}) => {
			log.verbose = verbose
			const expandedDirectory = untildify(directory)
			const globPattern = recursive ? `${expandedDirectory}/**/*.md` : `${expandedDirectory}/*.md`
			const paths = await globby(globPattern, { absolute: true })
			log.info(paths)

			if (paths.length === 0) {
				log.error(`No Markdown files found in "${expandedDirectory}".`)
				process.exitCode = 1
				return
			}

			const ankiUrl = new URL(ankiConnectHost)

			const report = await syncFiles(paths, {
				ankiConnectOptions: {
					autoLaunch: ankiAutoLaunch,
					host: `${ankiUrl.protocol}//${ankiUrl.hostname}`,
					port: Number.parseInt(ankiUrl.port, 10),
				},
				dryRun,
				namespace,
			})

			if (json) {
				process.stdout.write(JSON.stringify(report, undefined, 2))
				process.stdout.write('\n')
			} else {
				// TODO
			}

			process.exitCode = 0
		},
	)
	.command(
		'list',
		'List all Yanki notes in the Anki database.',
		(yargs) =>
			yargs.option('namespace', {
				alias: 'n',
				default: undefined,
				describe:
					'Limit the list to a specific namespace. Case insensitive. All notes are listed by default.',
				type: 'string',
			}),
		({ namespace }) => {
			console.log(namespace)
			console.log('TODO implementation')
			process.exitCode = 0
		},
	)
	.command(
		'delete',
		'Delete all Yanki notes in the Anki database. Careful.',
		(yargs) =>
			yargs
				.option('namespace', {
					alias: 'n',
					default: undefined,
					describe:
						'Limit the deletion to a specific namespace. Case insensitive. All notes are listed by default.',
					type: 'string',
				})
				.option('dry-run', {
					alias: 'd',
					default: false,
					describe:
						'Run the synchronization without making any changes. See a report of what would have been done.',
					type: 'boolean',
				})
				.option('yes', {
					alias: 'y',
					default: false,
					describe: 'No questions asked.',
					type: 'boolean',
				}),
		({ dryRun, namespace, yes }) => {
			console.log(namespace, yes, dryRun)
			console.log('TODO implementation')
			process.exitCode = 0
		},
	)
	.demandCommand(1)
	.alias('h', 'help')
	.version()
	.alias('v', 'version')
	.help()
	.wrap(process.stdout.isTTY ? Math.min(120, yargsInstance.terminalWidth()) : 0)
	.parse()

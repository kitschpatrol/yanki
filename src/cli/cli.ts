#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const yargsInstance = yargs(hideBin(process.argv))

await yargsInstance
	.scriptName('yanki')
	.command(
		'$0 <pattern>',
		'Process markdown files',
		(yargs) =>
			yargs
				.positional('pattern', {
					describe: 'Glob pattern for markdown files',
					type: 'string',
				})
				.option('dry-run', {
					alias: 'd',
					description: 'Run without making any changes',
					type: 'boolean',
				}),
		({ dryRun, pattern }) => {
			console.log(`Processing files matching pattern: ${pattern}`)
			if (dryRun) {
				console.log('--dry-run mode enabled, no changes will be made.')
			}

			// Glob(pattern, (error, files) => {
			// 	if (error) {
			// 		console.error('Error while matching pattern:', error)
			// 		process.exit(1)
			// 	}

			// 	for (const file of files) {
			// 		if (dryRun) {
			// 			console.log(`Would process file: ${file}`)
			// 		} else {
			// 			// Process the file (e.g., read, modify, write)
			// 			console.log(`Processing file: ${file}`)
			// 			const content = fs.readFileSync(file, 'utf8')
			// 			// Perform operations on the content
			// 			// fs.writeFileSync(file, modifiedContent);
			// 		}
			// 	}
			// })
		},
	)
	.demandCommand(1)
	.alias('h', 'help')
	.version()
	.alias('v', 'version')
	.help()
	.wrap(process.stdout.isTTY ? Math.min(120, yargsInstance.terminalWidth()) : 0)
	.parse()

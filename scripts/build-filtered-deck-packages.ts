/**
 * Builds the Anki packages imported by the filtered deck tests in
 * `test/sync.node.test.ts`, one per scenario in
 * `test/fixtures/filtered-deck-scenarios.ts`.
 *
 * Notes are rendered with Yanki's own loader from a temp copy of each
 * scenario's assets, laid out like the test's copy, so the test's first sync
 * matches them by content. Rebuild after changing a scenario, its assets, or
 * how Yanki renders notes.
 *
 * Usage: `pnpm tsx scripts/build-filtered-deck-packages.ts` (requires uv)
 */

import { execa } from 'execa'
import { globby } from 'globby'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'path-browserify-esm'
import { loadLocalNotes } from '../src/lib/actions/load-local-notes'
import { yankiModels } from '../src/lib/model/model'
import { NOTE_DEFAULT_DECK_NAME } from '../src/lib/shared/constants'
import { normalize } from '../src/lib/utilities/path'
import {
	FILTERED_DECK_SCENARIOS,
	getFilteredDeckLoadOptions,
	getFilteredDeckPackagePath,
} from '../test/fixtures/filtered-deck-scenarios'

for (const scenario of FILTERED_DECK_SCENARIOS) {
	const tempAssetPath = path.join(
		normalize(os.tmpdir()),
		Date.now().toString(),
		path.basename(scenario.assetPath),
	)
	await fs.cp(scenario.assetPath, tempAssetPath, { recursive: true })
	const markdownFiles = await globby('**/*.md', { absolute: true, cwd: tempAssetPath })
	const allFiles = await globby('**/*', { absolute: true, cwd: tempAssetPath })

	const localNotes = await loadLocalNotes(
		markdownFiles.toSorted(),
		getFilteredDeckLoadOptions(scenario, { allFiles: allFiles.toSorted(), tempAssetPath }),
	)
	// Media fields hold absolute source paths, which differ in each test's copy
	const pathDependentNote = localNotes.find(({ note }) =>
		JSON.stringify(note.fields).includes(tempAssetPath),
	)
	if (pathDependentNote !== undefined) {
		throw new Error(
			`"${pathDependentNote.filePathOriginal}" in "${scenario.description}" renders its temp path into a field, likely from media, so tests could not match it by content. Use notes without media.`,
		)
	}

	const notes = localNotes.map(({ note }) => ({
		deckName: note.deckName === '' ? NOTE_DEFAULT_DECK_NAME : note.deckName,
		fields: note.fields,
		modelName: note.modelName,
		tags: note.tags ?? [],
	}))
	const modelNames = new Set(notes.map(({ modelName }) => modelName))

	// Anki would silently create a missing parent as an empty deck
	const deckNames = new Set(notes.map(({ deckName }) => deckName))
	for (const { name } of scenario.filteredDecks) {
		const parentDeckName = name.split('::').slice(0, -1).join('::')
		if (parentDeckName !== '' && !deckNames.has(parentDeckName)) {
			throw new Error(
				`Filtered deck "${name}" in "${scenario.description}" must be nested under a deck with notes, but no note is in "${parentDeckName}". Decks with notes: ${[...deckNames].join(', ')}`,
			)
		}
	}

	const output = getFilteredDeckPackagePath(scenario)
	await fs.mkdir(path.dirname(output), { recursive: true })
	await execa('uv', ['run', '--quiet', 'scripts/build-filtered-deck-package.py'], {
		input: JSON.stringify({
			filteredDecks: scenario.filteredDecks,
			models: yankiModels.filter(({ modelName }) => modelNames.has(modelName)),
			notes,
			output,
		}),
		stderr: 'inherit',
	})
	await fs.rm(path.dirname(tempAssetPath), { force: true, recursive: true })

	console.log(`${path.relative(process.cwd(), output)}: ${notes.length} notes`)
}

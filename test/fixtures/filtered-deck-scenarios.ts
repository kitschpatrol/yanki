import path from 'node:path'
import { getTestNamespace } from '../utilities/test-constants'

/**
 * Notes in filtered decks, for tests that import them as an Anki package. No
 * AnkiConnect action can create or rebuild a filtered deck, so
 * `scripts/build-filtered-deck-packages.ts` builds each scenario's package from
 * its Markdown assets ahead of time.
 */
export type FilteredDeckScenario = {
	/** Markdown notes, synced from a temp copy like other file fixture tests */
	assetPath: string
	/** Test name, which also determines the note namespace */
	description: string
	/** Filtered decks to build, in order, once the notes exist */
	filteredDecks: Array<{ name: string; search: string }>
	/** Whether syncing passes the temp copy of the assets as the base path */
	hasBasePath: boolean
	obsidianVault: string
}

export const FILTERED_DECK_SCENARIOS: FilteredDeckScenario[] = [
	{
		// https://github.com/kitschpatrol/yanki-obsidian/issues/52
		assetPath: './test/assets/test-filtered-decks',
		description: 'filtered decks',
		filteredDecks: [{ name: 'Custom Study Session', search: 'tag:splines' }],
		hasBasePath: false,
		obsidianVault: 'Vault',
	},
	{
		assetPath: './test/assets/test-filtered-decks-deep',
		description: 'filtered decks alongside deep nesting',
		filteredDecks: [{ name: 'Custom Study Session', search: '*' }],
		hasBasePath: true,
		obsidianVault: 'Vault',
	},
	{
		// Two of the pulled notes live in deck-b, beside the filtered deck's parent
		assetPath: './test/assets/test-filtered-decks',
		description: 'filtered decks nested under another deck',
		filteredDecks: [{ name: 'deck-a::Custom Study Session', search: 'tag:splines' }],
		hasBasePath: false,
		obsidianVault: 'Vault',
	},
]

/**
 * Absolute path of a scenario's Anki package.
 */
export function getFilteredDeckPackagePath(scenario: FilteredDeckScenario): string {
	return path.resolve(
		'test/fixtures/filtered-deck-packages',
		`${scenario.description.replaceAll(' ', '-')}.apkg`,
	)
}

/**
 * Options for loading or syncing a scenario's notes from a temp copy of its
 * assets, shared by the package build and the tests so they render the same
 * notes.
 */
export function getFilteredDeckLoadOptions(
	scenario: FilteredDeckScenario,
	{ allFiles, tempAssetPath }: { allFiles: string[]; tempAssetPath: string },
) {
	return {
		allFilePaths: allFiles,
		...(scenario.hasBasePath && { basePath: tempAssetPath }),
		namespace: getTestNamespace(scenario.description),
		obsidianVault: scenario.obsidianVault,
		syncMediaAssets: 'off' as const,
	}
}

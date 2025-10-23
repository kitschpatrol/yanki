import { eslintConfig } from '@kitschpatrol/eslint-config'

export default eslintConfig({
	ignores: [
		'test/assets/test obsidian vault with spaces/**/*',
		'test/assets/test-deck-pruning/**/*',
		'test/assets/test-minimal-notes/basic-with-front-image-wiki-embed-and-no-back.md',
		'test/assets/test-fancy-markdown/**/*',
		'test/assets/test-obsidian-vault/**/*',
		'test/assets/test-unexpected-formatting/basic-and-reversed-card-with-confusing-setext-headline.md',
		'test/assets/test-unexpected-formatting/basic-with-confusing-setext-headline.md',
		'test/assets/test-unexpected-formatting/basic-with-tight-spacing-and-frontmatter.md',
		'test/assets/test-unexpected-formatting/basic-with-tight-spacing.md',
		'test/assets/test-cloze-back/**/*',
		'test/assets/test-unicode/**/*',
	],
	ts: {
		overrides: {
			'depend/ban-dependencies': [
				'error',
				{
					allowed: ['execa', 'strip-ansi', 'globby'],
				},
			],
			'ts/naming-convention': [
				'error',
				{
					format: ['UPPER_CASE'],
					modifiers: ['const', 'exported'],
					selector: 'variable',
					// Not objects...
					types: ['boolean', 'string', 'number', 'array'],
				},
			],
			'ts/no-unsafe-type-assertion': 'off',
			// Next major...
			'unicorn/no-array-sort': 'off',
		},
	},
	type: 'lib',
})

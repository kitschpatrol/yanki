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
			// Knip workaround...
			// https://github.com/webpro-nl/knip/issues/158#issuecomment-1632648598
			'jsdoc/check-tag-names': ['error', { definedTags: ['public'] }],
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
		},
	},
	type: 'lib',
})

// {
// 	files: ['./src/cli/**/*'],
// 	rules: {
// 		'n/shebang': 'off',
// 	},
// },

/* eslint-disable perfectionist/sort-objects */
/* @type {import('eslint').Linter.Config} */
module.exports = {
	root: true,
	extends: ['@kitschpatrol/eslint-config'],
	// Overrides
	overrides: [
		{
			files: ['*.ts'],
			rules: {
				// TODO move this to shared-config
				'@typescript-eslint/naming-convention': [
					'error',
					{
						selector: 'variable',
						modifiers: ['const', 'exported'],
						// Not objects...
						types: ['boolean', 'string', 'number', 'array'],
						format: ['UPPER_CASE'],
					},
				],
			},
		},
		{
			files: ['./src/cli/**/*'],
			rules: {
				'n/shebang': 'off',
			},
		},
	],
}

import sharedConfig, { overrideRules } from '@kitschpatrol/remark-config'

const localConfig = {
	...sharedConfig,
	plugins: overrideRules(sharedConfig.plugins, [
		['remark-lint-no-duplicate-headings', false],
		['remark-lint-no-file-name-articles', false],
		['remark-lint-no-undefined-references', false],
		// For test, TODO limit to specific files?
		['remark-lint-fenced-code-flag', false],
	]),
}

export default localConfig

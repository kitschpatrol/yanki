import sharedConfig, { overrideRules } from '@kitschpatrol/remark-config'

const localConfig = {
	...sharedConfig,
	plugins: overrideRules(sharedConfig.plugins, [
		['remark-lint-no-undefined-references', false],
		['remark-lint-no-file-name-articles', false],
	]),
}

export default localConfig

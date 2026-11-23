import { remarkConfig } from '@kitschpatrol/remark-config'

export default remarkConfig({
	rules: [
		['remark-lint-no-duplicate-headings', false],
		['remark-lint-no-file-name-articles', false],
		['remark-lint-no-undefined-references', false],
	],
})

import { knipConfig } from '@kitschpatrol/knip-config'

export default knipConfig({
	entry: ['test/utilities/field-mask.ts'],
	ignoreBinaries: ['anki', 'pkill', 'uv'],
	ignoreDependencies: [
		'@kitschpatrol/chagent', // Typically invoked through bumpp's --execute argument, which Knip doesn't parse
		'@types/lodash-es',
		'@types/unist',
		'remark',
	],
})

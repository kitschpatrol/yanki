import { knipConfig } from '@kitschpatrol/knip-config'

export default knipConfig({
	entry: ['test/utilities/field-mask.ts'],
	ignore: ['test/assets/**/*'],
	ignoreBinaries: ['anki', 'awk', 'launchctl', 'open', 'osascript', 'pkill', 'taskkill'],
	ignoreDependencies: [
		'@kitschpatrol/typescript-config',
		'@types/lodash-es',
		'@types/unist',
		'@vitest/coverage-v8',
		'playwright',
		'remark',
		'tsx',
	],
})

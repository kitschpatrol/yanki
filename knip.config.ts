import { knipConfig } from '@kitschpatrol/knip-config'

export default knipConfig({
	entry: ['test/utilities/field-mask.ts'],
	ignore: ['test/assets/**/*'],
	ignoreBinaries: ['osascript'],
	ignoreDependencies: ['@types/lodash-es', '@types/unist', 'playwright', 'remark', 'tsx'],
})

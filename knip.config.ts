import { knipConfig } from '@kitschpatrol/knip-config'

export default knipConfig({
	entry: ['test/utilities/field-mask.ts'],
	ignoreBinaries: ['anki', 'osascript', 'pkill'],
	ignoreDependencies: ['@types/lodash-es', '@types/unist', 'remark'],
})

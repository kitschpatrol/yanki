import { mdatConfig } from '@kitschpatrol/mdat-config'
import cliHelpPlugin from 'mdat-plugin-cli-help'

export default mdatConfig({
	rules: {
		...cliHelpPlugin,
	},
})

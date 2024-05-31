import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		// Enable serial mode
		sequence: {
			concurrent: false,
		},
	},
})

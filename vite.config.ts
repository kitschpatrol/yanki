// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
	// See vitest.workspace.ts for additional configuration
	test: {
		coverage: {
			all: false,
			include: ['src/**/*.ts'],
			provider: 'istanbul',
		},
		// Disable concurrent test execution across files
		// Yanki's tests count total file counts, irrespective of namespace, before
		// and after each test to ensure the integrity of pre-existing Anki notes.
		// Running tests concurrently across files can create race conditions in
		// total note counts that will cause assertions to fail.
		maxConcurrency: 1,
		poolOptions: {
			forks: {
				singleFork: true,
			},
		},
	},
})

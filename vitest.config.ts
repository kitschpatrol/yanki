import { playwright } from '@vitest/browser-playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		coverage: {
			include: ['src/**/*.ts'],
			provider: 'v8',
		},
		// Disable concurrent test execution across files
		// Yanki's tests count total file counts, irrespective of namespace, before
		// and after each test to ensure the integrity of pre-existing Anki notes.
		// Running tests concurrently across files can create race conditions in
		// total note counts that will cause assertions to fail.
		fileParallelism: false,
		maxConcurrency: 1,
		maxWorkers: 1,
		projects: [
			{
				// Browser project
				test: {
					browser: {
						// Conflicts between VS Code extension and vitest CLI command...
						api: {
							port: 5180,
							strictPort: true,
						},
						enabled: true,
						headless: true,
						instances: [{ browser: 'chromium' }],
						provider: playwright(),
						screenshotFailures: false,
					},
					exclude: ['test/**/*.node.test.ts'],
					include: ['test/**/*.test.ts'],
					name: 'browser',
				},
			},
			// Node project
			{
				test: {
					environment: 'node',
					exclude: ['test/**/*.browser.test.ts'],
					include: ['test/**/*.test.ts'],
					name: 'node',
					root: path.resolve(path.dirname(fileURLToPath(import.meta.url))),
				},
			},
		],
		// Needed?
		// restoreMocks: true,
		silent: 'passed-only', // Suppress console output during tests
	},
})

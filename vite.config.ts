// eslint-disable-next-line ts/triple-slash-reference
/// <reference types="vitest" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
		projects: [
			{
				extends: true,
				test: {
					browser: {
						// Conflicts between VS Code extension and vitest CLI command...
						api: {
							port: 5180,
							strictPort: true,
						},
						enabled: true,
						fileParallelism: false,
						headless: true,
						instances: [{ browser: 'chromium' }],
						provider: 'playwright',
					},
					exclude: ['test/**/*.node.test.ts'],
					include: ['test/**/*.test.ts'],
					maxConcurrency: 1,
					name: 'browser',
					poolOptions: {
						forks: {
							singleFork: true,
						},
					},
				},
			},
			{
				extends: true,
				test: {
					environment: 'node',
					exclude: ['test/**/*.browser.test.ts'],
					include: ['test/**/*.test.ts'],
					maxConcurrency: 1,
					name: 'node',
					poolOptions: {
						forks: {
							singleFork: true,
						},
					},
					root: path.resolve(path.dirname(fileURLToPath(import.meta.url))),
				},
			},
		],
		// RestoreMocks: true,
	},
})

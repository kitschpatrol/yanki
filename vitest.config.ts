import { playwright } from '@vitest/browser-playwright'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const isCI = Boolean(process.env.CI)
const isWindows = os.platform() === 'win32'
const isSlow = isCI || isWindows

export default defineConfig({
	test: {
		benchmark: {
			include: ['test/**/*.bench.ts'],
			includeSamples: true,
		},
		coverage: {
			include: ['src/**/*.ts'],
			provider: 'v8',
		},
		// Disable concurrent test execution across files Yanki's tests count total
		// file counts, irrespective of namespace, before and after each test to
		// ensure the integrity of pre-existing Anki notes. Running tests
		// concurrently across files can create race conditions in total note counts
		// that will cause assertions to fail.
		fileParallelism: false,
		globalSetup: './test/utilities/global-setup.ts',
		maxConcurrency: 1,
		maxWorkers: 1,
		projects: [
			// Browser tests require a running Anki instance with AnkiConnect, skip in CI
			...(isCI
				? []
				: [
						{
							test: {
								// Bench suites are Node-only; opt the browser project out
								benchmark: { include: [] },
								browser: {
									// Conflicts between VS Code extension and vitest CLI command...
									api: {
										port: 5180,
										strictPort: true,
									},
									enabled: true,
									headless: true,
									// FileParallelism: false at the instance level — top-level
									// fileParallelism only gates node workers, not browser pages.
									// Without this, files run concurrently in the single browser and
									// race against the shared Anki backend (e.g. two syncNotes calls
									// both trying to createModel for the same model).
									instances: [{ browser: 'chromium' as const, fileParallelism: false }],
									provider: playwright(),
									screenshotFailures: false,
								},
								exclude: ['test/**/*.node.test.ts'],
								include: ['test/**/*.test.ts'],
								name: 'browser',
								testTimeout: isSlow ? 30_000 : 5000,
							},
						},
					]),
			// Node project
			{
				test: {
					benchmark: {
						include: ['test/**/*.bench.ts'],
						includeSamples: true,
					},
					environment: 'node',
					exclude: ['test/**/*.browser.test.ts'],
					include: ['test/**/*.test.ts'],
					name: 'node',
					root: path.resolve(path.dirname(fileURLToPath(import.meta.url))),
					testTimeout: isSlow ? 30_000 : 5000,
				},
			},
		],
		// Needed?
		// restoreMocks: true,
		silent: 'passed-only', // Suppress console output during tests
	},
})

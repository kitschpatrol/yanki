// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="vitest" />
import { name } from './package.json'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { defineConfig } from 'vite'

const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), name))

export default defineConfig({
	build: {
		outDir: tempDirectory,
		rollupOptions: {
			external: ['open', 'promisify', 'execFile', 'fileURLToPath', 'constants', 'Buffer'],
			shimMissingExports: true,
		},
		target: 'esnext',
	},
	root: path.resolve(import.meta.dirname, 'test-browser'),
	server: {
		open: true,
	},
	test: {
		coverage: {
			all: false,
			include: ['src/**/*.ts'],
			provider: 'v8',
		},

		// Disable concurrent test execution across files
		// Yanki's tests count total file counts, irrespective of namespace, before
		// and after each test to ensure the integrity of pre-existing Anki notes.
		// Running tests concurrently across files can create race conditions in
		// total note counts that will cause assertions to fail.
		maxConcurrency: 1,
		maxWorkers: 1,
		minWorkers: 1,
		root: path.resolve(import.meta.dirname),
		sequence: {
			// Disable concurrent test execution within files
			concurrent: false,
		},
	},
})

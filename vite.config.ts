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
		// Enable serial mode
		sequence: {
			concurrent: false,
		},
	},
})

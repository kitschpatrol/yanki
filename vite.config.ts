import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
// Import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
	build: {
		lib: {
			entry: './src/lib/index.ts',
			fileName: () => `index.js`,
			formats: ['es'],
			name: 'yanki-md',
		},
		rollupOptions: {
			external: ['open'],

			input: './src/lib/index.ts',
			output: {
				dir: 'dist',

				entryFileNames: 'index.js',
				// File: 'index.js',
				// InlineDynamicImports: true,
				// manualChunks: false,
			},
		},
	},
	plugins: [
		dts({
			entryRoot: 'src/lib',
			exclude: ['src/cli/**/*', 'test/**/*'],
			include: 'src/lib/**/*',
			tsconfigPath: 'tsconfig.lib.json',
		}),
		// NodePolyfills({
		// 	// Exclude: ['process'],
		// 	// To add only specific polyfills, add them here. If no option is passed, adds all polyfills
		// 	// include: ['path'],
		// 	// ProtocolImports: true,
		// }),
	],
})

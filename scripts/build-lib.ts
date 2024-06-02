import esbuild from 'esbuild'
// Import type { Plugin } from 'esbuild'
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill'

// Const ignoreNodeModulesPlugin: Plugin = {
// 	name: 'ignore-node-modules',
// 	setup(build) {
// 		build.onResolve({ filter: /^node:.+$/ }, (args) => ({ external: true, path: args.path }))
// 	},
// }

// Works in browser, but not node...
await esbuild.build({
	bundle: true,
	entryPoints: ['src/lib/index.ts'],
	external: [
		'open',
		// 'http',
		// 'stream',
		// 'crypto',
		// 'child_process',
		// 'net',
		// 'tls',
		// 'https',
		// 'vm',
		// 'zlib',
		// 'tty',
		// 'os',
	],
	format: 'esm',
	mainFields: ['module', 'main'],
	minify: true,
	outfile: 'dist/index.js',

	platform: 'neutral',

	// Plugins: [ignoreNodeModulesPlugin()],
	plugins: [
		nodeModulesPolyfillPlugin({
			modules: {
				buffer: 'empty',
				// eslint-disable-next-line @typescript-eslint/naming-convention
				child_process: 'empty',
				fs: 'empty',
				'fs/promises': 'empty',
				os: 'empty',
				path: 'empty',
				process: 'empty',
				url: 'empty',
				util: 'empty',
			},
		}),
	],
	target: 'es2020',
	treeShaking: true,
	tsconfig: 'tsconfig.lib.json',
})

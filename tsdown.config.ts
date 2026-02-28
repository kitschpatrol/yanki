import { defineConfig } from 'tsdown'

export default defineConfig([
	// CLI
	{
		dts: false,
		entry: 'src/bin/cli.ts',
		fixedExtension: false,
		minify: true,
		noExternal: /.+/,
		outDir: 'dist/bin',
		platform: 'node',
		publint: true,
	},
	// Bundlers
	{
		entry: 'src/lib/index.ts',
		external: [/^node:/],
		fixedExtension: false,
		outDir: 'dist/lib',
		platform: 'neutral',
		target: ['node20.11.0', 'chrome100', 'safari18', 'firefox110'],
		tsconfig: 'tsconfig.build.json',
	},
	// Standalone browser / CDN
	{
		entry: 'src/lib/index.ts',
		external: [/^node:/],
		fixedExtension: false,
		minify: true,
		noExternal: /.+/,
		outDir: 'dist/standalone',
		platform: 'browser',
		target: ['chrome100', 'safari18', 'firefox110'],
		tsconfig: 'tsconfig.build.json',
	},
])

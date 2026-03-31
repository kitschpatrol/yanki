import { defineConfig } from 'tsdown'

export default defineConfig([
	// CLI
	{
		deps: { alwaysBundle: /.+/ },
		dts: false,
		entry: 'src/bin/cli.ts',
		fixedExtension: false,
		minify: true,
		outDir: 'dist/bin',
		platform: 'node',
		publint: true,
	},
	// Bundlers
	{
		deps: { neverBundle: [/^node:/] },
		entry: 'src/lib/index.ts',
		fixedExtension: false,
		outDir: 'dist/lib',
		platform: 'neutral',
		target: ['node20.11.0', 'chrome100', 'safari18', 'firefox110'],
		tsconfig: 'tsconfig.build.json',
	},
	// Standalone browser / CDN
	{
		deps: { alwaysBundle: /.+/, neverBundle: [/^node:/] },
		entry: 'src/lib/index.ts',
		fixedExtension: false,
		minify: true,
		outDir: 'dist/standalone',
		platform: 'browser',
		target: ['chrome100', 'safari18', 'firefox110'],
		tsconfig: 'tsconfig.build.json',
	},
])

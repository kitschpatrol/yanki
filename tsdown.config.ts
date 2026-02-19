import { defineConfig } from 'tsdown'

export default defineConfig([
	{
		dts: false,
		entry: 'src/bin/cli.ts',
		fixedExtension: false,
		minify: true,
		outDir: 'dist/bin',
		platform: 'node',
	},
	{
		attw: {
			profile: 'esm-only',
		},
		entry: 'src/lib/index.ts',
		external: [/^node:/],
		fixedExtension: false,
		minify: true,
		outDir: 'dist/lib',
		platform: 'neutral',
		target: ['node18.15.0', 'chrome100', 'safari18', 'firefox110'],
		tsconfig: 'tsconfig.build.json',
	},
])

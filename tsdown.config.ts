import { defineConfig } from 'tsdown'

export default defineConfig([
	{
		dts: false,
		entry: 'src/bin/cli.ts',
		fixedExtension: false,
		minify: true,
		outDir: 'dist/bin',
		platform: 'node',
		publint: true,
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
		publint: true,
		target: ['node20.11.0', 'chrome100', 'safari18', 'firefox110'],
		tsconfig: 'tsconfig.build.json',
	},
])

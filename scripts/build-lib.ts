import esbuild from 'esbuild'

await esbuild.build({
	bundle: true,
	entryPoints: ['src/lib/index.ts'],
	format: 'esm',
	minify: false,
	outfile: 'dist/lib/index.js',
	platform: 'node',
	target: 'node18',
})

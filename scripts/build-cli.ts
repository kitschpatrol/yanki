import esbuild from 'esbuild'

await esbuild.build({
	bundle: true,
	entryPoints: ['src/cli/cli.ts'],
	external: ['yargs'],
	format: 'esm',
	minify: false,
	outfile: 'bin/cli.js',
	platform: 'node',
	target: 'node18',
})

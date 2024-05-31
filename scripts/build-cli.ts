import esbuild from 'esbuild'

await esbuild.build({
	bundle: true,
	entryPoints: ['src/cli/cli.ts'],
	external: ['yargs', 'globby'],
	format: 'esm',
	minify: false,
	outfile: 'bin/cli.js',
	platform: 'node',
	target: 'node18',
})

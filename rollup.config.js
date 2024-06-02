import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'

export default [
	{
		input: './src/lib/index.ts',
		output: [
			{
				file: 'dist/index.js',
				format: 'es',
			},
		],
		plugins: [resolve(), typescript()],
	},
	{
		input: './src/lib/index.ts',
		output: {
			file: 'dist/types/my-library.d.ts',
			format: 'es',
		},
		plugins: [dts({})],
	},
]

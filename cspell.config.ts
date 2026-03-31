import { cspellConfig } from '@kitschpatrol/cspell-config'

export default cspellConfig({
	ignorePaths: [
		'**/*.svg',
		'test/assets/test-deck-pruning/**/*',
		'test/assets/test-unicode/**/*',
		'test/fixtures/anki-data-folder/**/*',
	],
	words: [
		'extglob',
		'Fpandas',
		'mathbf',
		'matroska',
		'mdank',
		'mdanki',
		'metametapod',
		'msvideo',
		'namespac',
		'pkill',
		'thisnotehasaverylongonewordtitlecanwestillsplititusingthe',
		'thisnotehasaverylongonewordtitlecanwestillsplititusingthetruncationalgorithm',
		'vmatrix',
	],
})

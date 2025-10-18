import { cspellConfig } from '@kitschpatrol/cspell-config'

export default cspellConfig({
	ignorePaths: ['test/assets/test-deck-pruning/*', 'test/assets/test-unicode/*', '**/*.svg'],
	words: [
		'clozing',
		'encloze',
		'Fpandas',
		'mathbf',
		'matroska',
		'mdank',
		'mdanki',
		'msvideo',
		'namespac',
		'npmjs',
		'thisnotehasaverylongonewordtitlecanwestillsplititusingthe',
		'thisnotehasaverylongonewordtitlecanwestillsplititusingthetruncationalgorithm',
		'vmatrix',
	],
})

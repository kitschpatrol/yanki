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
		'FEFF',
		'Fpandas',
		'mathbb',
		'mathbf',
		'mdank',
		'mdanki',
		'metametapod',
		'msvideo',
		'namespac',
		'Splintdewolfcry',
		'thisnotehasaverylongonewordtitlecanwestillsplititusingthe',
		'thisnotehasaverylongonewordtitlecanwestillsplititusingthetruncationalgorithm',
		'vmatrix',
	],
})

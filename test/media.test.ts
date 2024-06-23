import { syncFiles } from '../src/lib'
import { getFileExtensionFromUrl, getUrlContentHash } from '../src/lib/utilities/url'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { stableResults } from './utilities/stable-sync-results'
import { expect, it } from 'vitest'

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const fetchAdapter = globalThis.fetch.bind(globalThis)

const allRemoteMediaUrls = [
	'https://github.com/kitschpatrol/yanki/blob/main/test/assets/test-media/audio/yanki.wav?raw=true',
	'https://github.com/kitschpatrol/yanki/blob/main/test/assets/test-media/image/yanki.png?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.3gp?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.aac?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.avi?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.flac?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.flv?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.m4a?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.mkv?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.mov?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.mp3?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.mp4?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.mpeg?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.mpg?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.oga?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.ogg?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.ogv?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.ogx?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.opus?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.spx?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.swf?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.wav?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/audio/yanki.webm?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/image/yanki.avif?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/image/yanki.gif?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/image/yanki.ico?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/image/yanki.jpeg?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/image/yanki.jpg?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/image/yanki.png?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/image/yanki.svg?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/image/yanki.tif?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/image/yanki.tiff?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/image/yanki.webp?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/video/yanki.3gp?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/video/yanki.avi?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/video/yanki.flv?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/video/yanki.gif?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/video/yanki.mkv?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/video/yanki.mov?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/video/yanki.mp4?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/video/yanki.mpeg?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/video/yanki.mpg?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/video/yanki.ogv?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/video/yanki.swf?raw=true',
	'https://github.com/kitschpatrol/yanki/raw/main/test/assets/test-media/video/yanki.webm?raw=true',
	'https://images.unsplash.com/photo-1555685812-4b943f1cb0eb?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&h=800&ixid=MnwxfDB8MXxyYW5kb218MHx8a2l0dGVufHx8fHx8MTcxNzI5MTk1OQ&ixlib=rb-4.0.3&q=80&',
	'https://images.unsplash.com/photo-1574235664854-92e1da7d229a?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&h=800&ixid=MnwxfDB8MXxyYW5kb218MHx8Y2F0fHx8fHx8MTcxNzI5MjE0NQ&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&',
]

it('gets content type extension from url', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []
	for (const url of allRemoteMediaUrls) {
		const result = await getFileExtensionFromUrl(url, fetchAdapter)
		const { pathname } = new URL(url)
		const key = pathname.split('/').at(-1) ?? 'undefined'
		results.push({ [key]: result ?? 'undefined' })
	}

	const compactResults = results.map(
		(entry) => `${Object.keys(entry)[0]}: ${Object.values(entry)[0]}`,
	)

	expect(compactResults).toMatchInlineSnapshot(`
		[
		  "yanki.wav: wav",
		  "yanki.png: png",
		  "yanki.3gp: 3gp",
		  "yanki.aac: aac",
		  "yanki.avi: avi",
		  "yanki.flac: flac",
		  "yanki.flv: flv",
		  "yanki.m4a: m4a",
		  "yanki.mkv: mkv",
		  "yanki.mov: mov",
		  "yanki.mp3: mp3",
		  "yanki.mp4: mp4",
		  "yanki.mpeg: mpg",
		  "yanki.mpg: mpg",
		  "yanki.oga: ogg",
		  "yanki.ogg: ogg",
		  "yanki.ogv: ogv",
		  "yanki.ogx: mp4",
		  "yanki.opus: ogg",
		  "yanki.spx: ogg",
		  "yanki.swf: mp4",
		  "yanki.wav: wav",
		  "yanki.webm: webm",
		  "yanki.avif: avif",
		  "yanki.gif: gif",
		  "yanki.ico: ico",
		  "yanki.jpeg: jpg",
		  "yanki.jpg: jpg",
		  "yanki.png: png",
		  "yanki.svg: svg",
		  "yanki.tif: tif",
		  "yanki.tiff: tif",
		  "yanki.webp: webp",
		  "yanki.3gp: 3gp",
		  "yanki.avi: avi",
		  "yanki.flv: flv",
		  "yanki.gif: gif",
		  "yanki.mkv: mkv",
		  "yanki.mov: mov",
		  "yanki.mp4: mp4",
		  "yanki.mpeg: mpg",
		  "yanki.mpg: mpg",
		  "yanki.ogv: ogv",
		  "yanki.swf: mp4",
		  "yanki.webm: webm",
		  "photo-1555685812-4b943f1cb0eb: jpg",
		  "photo-1574235664854-92e1da7d229a: jpg",
		]
	`)
})

it('gets content hash url', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []
	for (const url of allRemoteMediaUrls) {
		const result = await getUrlContentHash(url, fetchAdapter)
		const { pathname } = new URL(url)
		const key = pathname.split('/').at(-1) ?? 'undefined'
		results.push({ [key]: result ?? 'undefined' })
	}

	const compactResults = results.map(
		(entry) => `${Object.keys(entry)[0]}: ${Object.values(entry)[0]}`,
	)

	expect(compactResults).toMatchInlineSnapshot(`
		[
		  "yanki.wav: cb606ffee01736cb",
		  "yanki.png: c8b37aeccc867deb",
		  "yanki.3gp: 47dd565df439dfd7",
		  "yanki.aac: 9383612f5f369316",
		  "yanki.avi: 4f90e907db61d2a8",
		  "yanki.flac: c0f8886fc75ac3be",
		  "yanki.flv: c63881042f607fd6",
		  "yanki.m4a: 08616299535d38fc",
		  "yanki.mkv: 709316eb037d59c4",
		  "yanki.mov: 8f784796233cfff7",
		  "yanki.mp3: 88d3407c7bd4183e",
		  "yanki.mp4: c153f74a48eb3e19",
		  "yanki.mpeg: d73435b159cc7bf7",
		  "yanki.mpg: d73435b159cc7bf7",
		  "yanki.oga: f951458ca48fe841",
		  "yanki.ogg: cfb1898c20340c8c",
		  "yanki.ogv: ca4de9ea8761b3cf",
		  "yanki.ogx: 761717bbaf50ca4a",
		  "yanki.opus: a9e401fab8103e53",
		  "yanki.spx: 79deee151e96700a",
		  "yanki.swf: a04e1fea4d00a296",
		  "yanki.wav: cb606ffee01736cb",
		  "yanki.webm: 90965bdf99db0abd",
		  "yanki.avif: 0b44281837970327",
		  "yanki.gif: 37db5d477188a1f2",
		  "yanki.ico: 3a950c00367472e2",
		  "yanki.jpeg: 64140e940e0eb276",
		  "yanki.jpg: 64140e940e0eb276",
		  "yanki.png: c8b37aeccc867deb",
		  "yanki.svg: 195a484048295fc6",
		  "yanki.tif: f44450f0e7d4f47d",
		  "yanki.tiff: f44450f0e7d4f47d",
		  "yanki.webp: f45cd13d1b867070",
		  "yanki.3gp: d395ea86537bdcf7",
		  "yanki.avi: b470c485d1d7235d",
		  "yanki.flv: 1a314ce217012ad7",
		  "yanki.gif: 331e0f2fa33119c6",
		  "yanki.mkv: 4582db56c31c8128",
		  "yanki.mov: 553425008d4f011f",
		  "yanki.mp4: 15650cc23035e306",
		  "yanki.mpeg: 3a1f9bd184d72afb",
		  "yanki.mpg: 3a1f9bd184d72afb",
		  "yanki.ogv: 375c411b96f9548f",
		  "yanki.swf: a6d2cff538706b9e",
		  "yanki.webm: 383e8f0b7284a148",
		  "photo-1555685812-4b943f1cb0eb: c8f0f244d1a0cde9",
		  "photo-1574235664854-92e1da7d229a: ca2954941f3dc020",
		]
	`)
})

describeWithFileFixture(
	'media',
	{
		assetPath: './test/assets/test-media/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('adds media to anki when appropriate', { timeout: 60_000 }, async () => {
			const results = await syncFiles(context.files, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				syncMediaAssets: 'local',
			})

			expect(stableResults(results)).toMatchSnapshot()
		})
	},
)

describeWithFileFixture(
	'remote media',
	{
		assetPath: './test/assets/test-media-remote/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('fetches and adds media urls to anki when appropriate', { timeout: 60_000 }, async () => {
			const results = await syncFiles(context.files, {
				ankiConnectOptions: {
					autoLaunch: true,
				},
				ankiWeb: false,
				dryRun: false,
				namespace: context.namespace,
				syncMediaAssets: 'remote',
			})

			expect(stableResults(results)).toMatchSnapshot()
		})
	},
)

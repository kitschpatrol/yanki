import path from 'node:path'
import { expect, it } from 'vitest'
import { syncFiles } from '../src/lib'
import { getDefaultFileAdapter } from '../src/lib/shared/types'
import { getFileContentHash } from '../src/lib/utilities/file'
import { mediaAssetExists } from '../src/lib/utilities/media'
import { getFileExtensionFromUrl, getUrlContentHash, safeParseUrl } from '../src/lib/utilities/url'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { stableResults } from './utilities/stable-sync-results'

const fetchAdapter = fetch.bind(globalThis)

const allLocalMediaPaths = [
	'./test/assets/test-media/audio/yanki.3gp',
	'./test/assets/test-media/audio/yanki.aac',
	'./test/assets/test-media/audio/yanki.avi',
	'./test/assets/test-media/audio/yanki.flac',
	'./test/assets/test-media/audio/yanki.flv',
	'./test/assets/test-media/audio/yanki.m4a',
	'./test/assets/test-media/audio/yanki.mkv',
	'./test/assets/test-media/audio/yanki.mov',
	'./test/assets/test-media/audio/yanki.mp3',
	'./test/assets/test-media/audio/yanki.mp4',
	'./test/assets/test-media/audio/yanki.mpeg',
	'./test/assets/test-media/audio/yanki.mpg',
	'./test/assets/test-media/audio/yanki.oga',
	'./test/assets/test-media/audio/yanki.ogg',
	'./test/assets/test-media/audio/yanki.ogv',
	'./test/assets/test-media/audio/yanki.ogx',
	'./test/assets/test-media/audio/yanki.opus',
	'./test/assets/test-media/audio/yanki.spx',
	'./test/assets/test-media/audio/yanki.swf',
	'./test/assets/test-media/audio/yanki.wav',
	'./test/assets/test-media/audio/yanki.webm',
	'./test/assets/test-media/file/yanki.md',
	'./test/assets/test-media/file/yanki.pdf',
	'./test/assets/test-media/image/yanki.avif',
	'./test/assets/test-media/image/yanki.gif',
	'./test/assets/test-media/image/yanki.ico',
	'./test/assets/test-media/image/yanki.jpeg',
	'./test/assets/test-media/image/yanki.jpg',
	'./test/assets/test-media/image/yanki.png',
	'./test/assets/test-media/image/yanki.svg',
	'./test/assets/test-media/image/yanki.tif',
	'./test/assets/test-media/image/yanki.tiff',
	'./test/assets/test-media/image/yanki.webp',
	'./test/assets/test-media/video/yanki.3gp',
	'./test/assets/test-media/video/yanki.avi',
	'./test/assets/test-media/video/yanki.flv',
	'./test/assets/test-media/video/yanki.gif',
	'./test/assets/test-media/video/yanki.mkv',
	'./test/assets/test-media/video/yanki.mov',
	'./test/assets/test-media/video/yanki.mp4',
	'./test/assets/test-media/video/yanki.mpeg',
	'./test/assets/test-media/video/yanki.mpg',
	'./test/assets/test-media/video/yanki.ogv',
	'./test/assets/test-media/video/yanki.swf',
	'./test/assets/test-media/video/yanki.webm',
	'./test/assets/test-media/weird-filenames/i am an obscenely long filename of tremendous length that will have to be truncated in a thoughtful way to preserve as much semantic value as possible.jpg',
	'./test/assets/test-media/weird-filenames/i have so many spaces.jpg',
	'./test/assets/test-media/weird-filenames/i.have.many.dots.jpg',
]

const allRemoteMediaUrls = [
	'https://raw.githubusercontent.com/kitschpatrol/yanki/refs/heads/main/test/assets/test-media/audio/yanki.wav',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/refs/heads/main/test/assets/test-media/image/yanki.png',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.3gp',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.aac',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.avi',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.flac',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.flv',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.m4a',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.mkv',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.mov',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.mp3',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.mp4',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.mpeg',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.mpg',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.oga',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.ogg',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.ogv',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.ogx',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.opus',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.spx',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.swf',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.wav',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/audio/yanki.webm',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/file/yanki.md',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/file/yanki.pdf',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/image/yanki.avif',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/image/yanki.gif',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/image/yanki.ico',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/image/yanki.jpeg',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/image/yanki.jpg',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/image/yanki.png',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/image/yanki.svg',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/image/yanki.tif',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/image/yanki.tiff',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/image/yanki.webp',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/video/yanki.3gp',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/video/yanki.avi',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/video/yanki.flv',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/video/yanki.gif',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/video/yanki.mkv',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/video/yanki.mov',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/video/yanki.mp4',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/video/yanki.mpeg',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/video/yanki.mpg',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/video/yanki.ogv',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/video/yanki.swf',
	'https://raw.githubusercontent.com/kitschpatrol/yanki/main/test/assets/test-media/video/yanki.webm',
	'https://storage.kitschpatrol.com/example-image-1',
	'https://storage.kitschpatrol.com/example-image-2',
]

it('correctly detects existence or non-existence of media files', { timeout: 60_000 }, async () => {
	const fileAdapter = await getDefaultFileAdapter()

	expect(await mediaAssetExists(allLocalMediaPaths[0]!, fileAdapter, fetchAdapter)).toBe(true)

	expect(await mediaAssetExists(allRemoteMediaUrls[0]!, fileAdapter, fetchAdapter)).toBe(true)

	expect(
		await mediaAssetExists('./6C9CFA9A-5D1A-4B55-A404-64DBFA034B93.jpg', fileAdapter, fetchAdapter),
	).toBe(false)

	expect(
		await mediaAssetExists(
			'https://6C9CFA9A-5D1A-4B55-A404-64DBFA034B93.com/example.jpg',
			fileAdapter,
			fetchAdapter,
		),
	).toBe(false)
})

it('gets content type extension from url metadata', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []
	for (const url of allRemoteMediaUrls) {
		const result = await getFileExtensionFromUrl(url, fetchAdapter, 'metadata')
		const parsedUrl = safeParseUrl(url)
		if (parsedUrl === undefined) {
			throw new Error(`Could not parse URL: ${url}`)
		}

		const { pathname } = parsedUrl
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
		  "yanki.md: md",
		  "yanki.pdf: mp4",
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
		  "example-image-1: jpg",
		  "example-image-2: jpg",
		]
	`)
})

it('gets content type extension from url name', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []
	for (const url of allRemoteMediaUrls) {
		const result = await getFileExtensionFromUrl(url, fetchAdapter, 'name')
		const parsedUrl = safeParseUrl(url)
		if (parsedUrl === undefined) {
			throw new Error(`Could not parse URL: ${url}`)
		}

		const { pathname } = parsedUrl
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
		  "yanki.mpeg: mpeg",
		  "yanki.mpg: mpg",
		  "yanki.oga: oga",
		  "yanki.ogg: ogg",
		  "yanki.ogv: ogv",
		  "yanki.ogx: ogx",
		  "yanki.opus: opus",
		  "yanki.spx: spx",
		  "yanki.swf: swf",
		  "yanki.wav: wav",
		  "yanki.webm: webm",
		  "yanki.md: md",
		  "yanki.pdf: pdf",
		  "yanki.avif: avif",
		  "yanki.gif: gif",
		  "yanki.ico: ico",
		  "yanki.jpeg: jpeg",
		  "yanki.jpg: jpg",
		  "yanki.png: png",
		  "yanki.svg: svg",
		  "yanki.tif: tif",
		  "yanki.tiff: tiff",
		  "yanki.webp: webp",
		  "yanki.3gp: 3gp",
		  "yanki.avi: avi",
		  "yanki.flv: flv",
		  "yanki.gif: gif",
		  "yanki.mkv: mkv",
		  "yanki.mov: mov",
		  "yanki.mp4: mp4",
		  "yanki.mpeg: mpeg",
		  "yanki.mpg: mpg",
		  "yanki.ogv: ogv",
		  "yanki.swf: swf",
		  "yanki.webm: webm",
		  "example-image-1: undefined",
		  "example-image-2: undefined",
		]
	`)
})

it('gets content hash from url content', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []
	for (const url of allRemoteMediaUrls) {
		const result = await getUrlContentHash(url, fetchAdapter, 'content')
		const parsedUrl = safeParseUrl(url)
		if (parsedUrl === undefined) {
			throw new Error(`Could not parse URL: ${url}`)
		}

		const { pathname } = parsedUrl
		const key = pathname.split('/').at(-1) ?? 'undefined'
		// eslint-disable-next-line ts/no-unnecessary-condition
		results.push({ [key]: result ?? 'undefined' })
	}

	const compactResults = results.map(
		(entry) => `${Object.keys(entry)[0]}: ${Object.values(entry)[0]}`,
	)

	expect(compactResults).toMatchInlineSnapshot(`
		[
		  "yanki.wav: 3732f358a60bc464",
		  "yanki.png: cebd69f0ed1ade30",
		  "yanki.3gp: 9d415ef2b9a87623",
		  "yanki.aac: 7cac144ecf672cb1",
		  "yanki.avi: 22fbac3b91ee9d44",
		  "yanki.flac: be968293e79f0bd8",
		  "yanki.flv: 9970d79f282b2d58",
		  "yanki.m4a: 72d73898d8070856",
		  "yanki.mkv: ff5aaa3381faf698",
		  "yanki.mov: 742704991f388abf",
		  "yanki.mp3: 133037d1f425794e",
		  "yanki.mp4: f61de104142bea7a",
		  "yanki.mpeg: bc5750d73e57e638",
		  "yanki.mpg: c27f0e0730dd3c83",
		  "yanki.oga: e251601a0cf39ca4",
		  "yanki.ogg: 6fdaa32d4e752185",
		  "yanki.ogv: e9c1923031ef749d",
		  "yanki.ogx: ab399989ab7edcaa",
		  "yanki.opus: e9684ba7b84cae98",
		  "yanki.spx: 55e7ef713ea96fad",
		  "yanki.swf: 86c80be3ecfa5a00",
		  "yanki.wav: 15c84289a18a2d8b",
		  "yanki.webm: b4dbde905b9bda1c",
		  "yanki.md: ee24aff37937ba74",
		  "yanki.pdf: 34069c4dec4c09bb",
		  "yanki.avif: b5e3caa2e5c00594",
		  "yanki.gif: ceb285d3037ec0d7",
		  "yanki.ico: f17d92cc062f795a",
		  "yanki.jpeg: 8e887402aec8054f",
		  "yanki.jpg: 3747ec2ff2132d0c",
		  "yanki.png: 882695adb933f299",
		  "yanki.svg: 0c327a2ef8abe849",
		  "yanki.tif: dd3f34f7b9e8dfcb",
		  "yanki.tiff: 6ba38946f29c771f",
		  "yanki.webp: 9d7f4bf188932bfd",
		  "yanki.3gp: f73bd14bedb715ee",
		  "yanki.avi: 25f875e75b39f128",
		  "yanki.flv: 3a38f5fa0f46c1e0",
		  "yanki.gif: ee698602a8f2be1f",
		  "yanki.mkv: faa68b5cc45978c5",
		  "yanki.mov: b09d153dfb33a4ee",
		  "yanki.mp4: 6103b4e30809fb9a",
		  "yanki.mpeg: bee86a817092bc29",
		  "yanki.mpg: aa21bc96b4a9ad12",
		  "yanki.ogv: 6d12ad0553cd4d0a",
		  "yanki.swf: e531b5ca0adf6aa1",
		  "yanki.webm: 6414e60fed0bf0ba",
		  "example-image-1: b50276c0537a910b",
		  "example-image-2: 5afb49f5931172e1",
		]
	`)
})

it('gets content hash from url metadata', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []
	for (const url of allRemoteMediaUrls) {
		const result = await getUrlContentHash(url, fetchAdapter, 'metadata')
		const parsedUrl = safeParseUrl(url)
		if (parsedUrl === undefined) {
			throw new Error(`Could not parse URL: ${url}`)
		}

		const { pathname } = parsedUrl
		const key = pathname.split('/').at(-1) ?? 'undefined'
		// eslint-disable-next-line ts/no-unnecessary-condition
		results.push({ [key]: result ?? 'undefined' })
	}

	const compactResults = results.map(
		(entry) => `${Object.keys(entry)[0]}: ${Object.values(entry)[0]}`,
	)

	expect(compactResults).toMatchInlineSnapshot(`
		[
		  "yanki.wav: 3732f358a60bc464",
		  "yanki.png: cebd69f0ed1ade30",
		  "yanki.3gp: 9d415ef2b9a87623",
		  "yanki.aac: 7cac144ecf672cb1",
		  "yanki.avi: 22fbac3b91ee9d44",
		  "yanki.flac: be968293e79f0bd8",
		  "yanki.flv: 9970d79f282b2d58",
		  "yanki.m4a: 72d73898d8070856",
		  "yanki.mkv: ff5aaa3381faf698",
		  "yanki.mov: 742704991f388abf",
		  "yanki.mp3: 133037d1f425794e",
		  "yanki.mp4: f61de104142bea7a",
		  "yanki.mpeg: bc5750d73e57e638",
		  "yanki.mpg: c27f0e0730dd3c83",
		  "yanki.oga: e251601a0cf39ca4",
		  "yanki.ogg: 6fdaa32d4e752185",
		  "yanki.ogv: e9c1923031ef749d",
		  "yanki.ogx: ab399989ab7edcaa",
		  "yanki.opus: e9684ba7b84cae98",
		  "yanki.spx: 55e7ef713ea96fad",
		  "yanki.swf: 86c80be3ecfa5a00",
		  "yanki.wav: 15c84289a18a2d8b",
		  "yanki.webm: b4dbde905b9bda1c",
		  "yanki.md: ee24aff37937ba74",
		  "yanki.pdf: 34069c4dec4c09bb",
		  "yanki.avif: b5e3caa2e5c00594",
		  "yanki.gif: ceb285d3037ec0d7",
		  "yanki.ico: f17d92cc062f795a",
		  "yanki.jpeg: 8e887402aec8054f",
		  "yanki.jpg: 3747ec2ff2132d0c",
		  "yanki.png: 882695adb933f299",
		  "yanki.svg: 0c327a2ef8abe849",
		  "yanki.tif: dd3f34f7b9e8dfcb",
		  "yanki.tiff: 6ba38946f29c771f",
		  "yanki.webp: 9d7f4bf188932bfd",
		  "yanki.3gp: f73bd14bedb715ee",
		  "yanki.avi: 25f875e75b39f128",
		  "yanki.flv: 3a38f5fa0f46c1e0",
		  "yanki.gif: ee698602a8f2be1f",
		  "yanki.mkv: faa68b5cc45978c5",
		  "yanki.mov: b09d153dfb33a4ee",
		  "yanki.mp4: 6103b4e30809fb9a",
		  "yanki.mpeg: bee86a817092bc29",
		  "yanki.mpg: aa21bc96b4a9ad12",
		  "yanki.ogv: 6d12ad0553cd4d0a",
		  "yanki.swf: e531b5ca0adf6aa1",
		  "yanki.webm: 6414e60fed0bf0ba",
		  "example-image-1: b50276c0537a910b",
		  "example-image-2: 5afb49f5931172e1",
		]
	`)
})

it('gets content hash from url name', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []
	for (const url of allRemoteMediaUrls) {
		const result = await getUrlContentHash(url, fetchAdapter, 'name')
		const parsedUrl = safeParseUrl(url)
		if (parsedUrl === undefined) {
			throw new Error(`Could not parse URL: ${url}`)
		}

		const { pathname } = parsedUrl
		const key = pathname.split('/').at(-1) ?? 'undefined'
		// eslint-disable-next-line ts/no-unnecessary-condition
		results.push({ [key]: result ?? 'undefined' })
	}

	const compactResults = results.map(
		(entry) => `${Object.keys(entry)[0]}: ${Object.values(entry)[0]}`,
	)

	expect(compactResults).toMatchInlineSnapshot(`
		[
		  "yanki.wav: d4c3bd9247ccef36",
		  "yanki.png: ed08b49504d88864",
		  "yanki.3gp: 00713f95ed50fa51",
		  "yanki.aac: 4e922a94f759dbb8",
		  "yanki.avi: 4ed94494f7960a89",
		  "yanki.flac: f42bb35ba1f3caaf",
		  "yanki.flv: 8be14e951a44275f",
		  "yanki.m4a: 2ba4a494e37cd8bb",
		  "yanki.mkv: 2afd8b94e2ee6419",
		  "yanki.mov: 2af09b94e2e3f4ed",
		  "yanki.mp3: 2ad8ce94e2cfb9b5",
		  "yanki.mp4: 2ad8c794e2cfadd0",
		  "yanki.mpeg: 9cfcd8fd6600e39c",
		  "yanki.mpg: 2ad87a94e2cf2af9",
		  "yanki.oga: 3c6c0294ecd6045a",
		  "yanki.ogg: 3c6bfc94ecd5fa28",
		  "yanki.ogv: 3c6bed94ecd5e0ab",
		  "yanki.ogx: 3c6beb94ecd5dd45",
		  "yanki.opus: f111a10eae851a1e",
		  "yanki.spx: d439f594b1bfb456",
		  "yanki.swf: d428f194b1b13a57",
		  "yanki.wav: f7f29594c64896e5",
		  "yanki.webm: be4c57cd028be300",
		  "yanki.md: 989b0948dd725c7c",
		  "yanki.pdf: a88f47d03b3d1c3d",
		  "yanki.avif: 1e6f3a7470f86314",
		  "yanki.gif: 8069f8e8d92a2bfe",
		  "yanki.ico: 0586b3e8931a19fd",
		  "yanki.jpeg: 848f3f38d31cc576",
		  "yanki.jpg: 0d2af4e897248a6f",
		  "yanki.png: b6bb3ae8663c2a7f",
		  "yanki.svg: d329b5e87708a806",
		  "yanki.tif: da5fffe87ab4a2e3",
		  "yanki.tiff: c5c25d0880f027ff",
		  "yanki.webp: 2e3c4521406ad90a",
		  "yanki.3gp: 577c82d8be131de4",
		  "yanki.avi: ca2a0dd7dd5a19ec",
		  "yanki.flv: d1863bd7e126b472",
		  "yanki.gif: dbec74d7e7882bfc",
		  "yanki.mkv: 3291fed8189dc9cc",
		  "yanki.mov: 3284fed818933f70",
		  "yanki.mp4: 32e0c2d818e13829",
		  "yanki.mpeg: 55c35332473abcd3",
		  "yanki.mpg: 32e0efd818e184a0",
		  "yanki.ogv: 2065acd80e153f62",
		  "yanki.swf: 2e9b30d78558331e",
		  "yanki.webm: 0ad9bf56aa0de00b",
		  "example-image-1: 9561657386313a7b",
		  "example-image-2: 9561667386313c2e",
		]
	`)
})

it('gets content hash from file content', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []

	for (const filePath of allLocalMediaPaths) {
		const result = await getFileContentHash(filePath, await getDefaultFileAdapter(), 'content')
		const key = path.posix.basename(filePath)
		// eslint-disable-next-line ts/no-unnecessary-condition
		results.push({ [key]: result ?? 'undefined' })
	}

	const compactResults = results.map(
		(entry) => `${Object.keys(entry)[0]}: ${Object.values(entry)[0]}`,
	)

	expect(compactResults).toMatchInlineSnapshot(`
		[
		  "yanki.3gp: bba78bb94b9e6e05",
		  "yanki.aac: dea3afc906fbd199",
		  "yanki.avi: da3e19e63e94a698",
		  "yanki.flac: 17f3b98b233cac56",
		  "yanki.flv: 24f434ca151b2f64",
		  "yanki.m4a: 2745ab23d6596804",
		  "yanki.mkv: ec05fb9ca9000b1a",
		  "yanki.mov: c110680575442a1b",
		  "yanki.mp3: 6f2a55dc001652e4",
		  "yanki.mp4: 5725aa25f2d4df11",
		  "yanki.mpeg: 4146e06c885e6e90",
		  "yanki.mpg: 4146e06c885e6e90",
		  "yanki.oga: a440bf0b758da0a9",
		  "yanki.ogg: d66588713dad1e8f",
		  "yanki.ogv: a676e89ef81b3e10",
		  "yanki.ogx: 4420873255ff5fe4",
		  "yanki.opus: 78105101f4040297",
		  "yanki.spx: ea862d6a3a61686f",
		  "yanki.swf: 2f4a7a6a9e7364fb",
		  "yanki.wav: 1c643b9e7bd7829e",
		  "yanki.webm: 30dad8fffde9b2af",
		  "yanki.md: 535914bcf4b86718",
		  "yanki.pdf: a73f88d2bb06f68c",
		  "yanki.avif: 13dd44beaa1aaaeb",
		  "yanki.gif: 2fd4962fc749d790",
		  "yanki.ico: 00d3a18bbad0fe99",
		  "yanki.jpeg: 2d66184d2677c1a5",
		  "yanki.jpg: 2d66184d2677c1a5",
		  "yanki.png: a2b3b387877733a3",
		  "yanki.svg: f8bf3e4129b4bd19",
		  "yanki.tif: a0ead4239da4d4eb",
		  "yanki.tiff: a0ead4239da4d4eb",
		  "yanki.webp: 8f960d8c851e0749",
		  "yanki.3gp: ab6f2b977dec6c89",
		  "yanki.avi: 749d588a8c5739c4",
		  "yanki.flv: c1cf7aa628221dfd",
		  "yanki.gif: 21d8e458040c9c59",
		  "yanki.mkv: 5309b62e7a392acc",
		  "yanki.mov: 66a671253ea9c410",
		  "yanki.mp4: 50bd852f752e86ad",
		  "yanki.mpeg: 009e8b68e7fbbeec",
		  "yanki.mpg: 009e8b68e7fbbeec",
		  "yanki.ogv: d75b1b60a458d1e4",
		  "yanki.swf: 7ea99adc8ba79bec",
		  "yanki.webm: 967e6b2dc20b54b3",
		  "i am an obscenely long filename of tremendous length that will have to be truncated in a thoughtful way to preserve as much semantic value as possible.jpg: 2d66184d2677c1a5",
		  "i have so many spaces.jpg: 2d66184d2677c1a5",
		  "i.have.many.dots.jpg: 2d66184d2677c1a5",
		]
	`)
})

it('gets content hash from file metadata', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []

	for (const filePath of allLocalMediaPaths) {
		const result = await getFileContentHash(filePath, await getDefaultFileAdapter(), 'metadata')
		const key = path.posix.basename(filePath)
		// eslint-disable-next-line ts/no-unnecessary-condition
		results.push({ [key]: result ?? 'undefined' })
	}

	// Not stable across checkouts
	const compactResults = results.map(
		(entry) =>
			`${Object.keys(entry)[0]}: ${Object.values(entry)[0]!.replaceAll(/[\da-f]{16}/gv, 'XXXXXXXXXXXXXXXX')}`,
	)

	expect(compactResults).toMatchInlineSnapshot(`
		[
		  "yanki.3gp: XXXXXXXXXXXXXXXX",
		  "yanki.aac: XXXXXXXXXXXXXXXX",
		  "yanki.avi: XXXXXXXXXXXXXXXX",
		  "yanki.flac: XXXXXXXXXXXXXXXX",
		  "yanki.flv: XXXXXXXXXXXXXXXX",
		  "yanki.m4a: XXXXXXXXXXXXXXXX",
		  "yanki.mkv: XXXXXXXXXXXXXXXX",
		  "yanki.mov: XXXXXXXXXXXXXXXX",
		  "yanki.mp3: XXXXXXXXXXXXXXXX",
		  "yanki.mp4: XXXXXXXXXXXXXXXX",
		  "yanki.mpeg: XXXXXXXXXXXXXXXX",
		  "yanki.mpg: XXXXXXXXXXXXXXXX",
		  "yanki.oga: XXXXXXXXXXXXXXXX",
		  "yanki.ogg: XXXXXXXXXXXXXXXX",
		  "yanki.ogv: XXXXXXXXXXXXXXXX",
		  "yanki.ogx: XXXXXXXXXXXXXXXX",
		  "yanki.opus: XXXXXXXXXXXXXXXX",
		  "yanki.spx: XXXXXXXXXXXXXXXX",
		  "yanki.swf: XXXXXXXXXXXXXXXX",
		  "yanki.wav: XXXXXXXXXXXXXXXX",
		  "yanki.webm: XXXXXXXXXXXXXXXX",
		  "yanki.md: XXXXXXXXXXXXXXXX",
		  "yanki.pdf: XXXXXXXXXXXXXXXX",
		  "yanki.avif: XXXXXXXXXXXXXXXX",
		  "yanki.gif: XXXXXXXXXXXXXXXX",
		  "yanki.ico: XXXXXXXXXXXXXXXX",
		  "yanki.jpeg: XXXXXXXXXXXXXXXX",
		  "yanki.jpg: XXXXXXXXXXXXXXXX",
		  "yanki.png: XXXXXXXXXXXXXXXX",
		  "yanki.svg: XXXXXXXXXXXXXXXX",
		  "yanki.tif: XXXXXXXXXXXXXXXX",
		  "yanki.tiff: XXXXXXXXXXXXXXXX",
		  "yanki.webp: XXXXXXXXXXXXXXXX",
		  "yanki.3gp: XXXXXXXXXXXXXXXX",
		  "yanki.avi: XXXXXXXXXXXXXXXX",
		  "yanki.flv: XXXXXXXXXXXXXXXX",
		  "yanki.gif: XXXXXXXXXXXXXXXX",
		  "yanki.mkv: XXXXXXXXXXXXXXXX",
		  "yanki.mov: XXXXXXXXXXXXXXXX",
		  "yanki.mp4: XXXXXXXXXXXXXXXX",
		  "yanki.mpeg: XXXXXXXXXXXXXXXX",
		  "yanki.mpg: XXXXXXXXXXXXXXXX",
		  "yanki.ogv: XXXXXXXXXXXXXXXX",
		  "yanki.swf: XXXXXXXXXXXXXXXX",
		  "yanki.webm: XXXXXXXXXXXXXXXX",
		  "i am an obscenely long filename of tremendous length that will have to be truncated in a thoughtful way to preserve as much semantic value as possible.jpg: XXXXXXXXXXXXXXXX",
		  "i have so many spaces.jpg: XXXXXXXXXXXXXXXX",
		  "i.have.many.dots.jpg: XXXXXXXXXXXXXXXX",
		]
	`)
})

it('gets content hash from file name', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []

	for (const filePath of allLocalMediaPaths) {
		const result = await getFileContentHash(filePath, await getDefaultFileAdapter(), 'name')
		const key = path.posix.basename(filePath)
		// eslint-disable-next-line ts/no-unnecessary-condition
		results.push({ [key]: result ?? 'undefined' })
	}

	const compactResults = results.map(
		(entry) => `${Object.keys(entry)[0]}: ${Object.values(entry)[0]}`,
	)

	expect(compactResults).toMatchInlineSnapshot(`
		[
		  "yanki.3gp: 29a391b158dd1c84",
		  "yanki.aac: ed59beb2e8fcaa81",
		  "yanki.avi: eda79cb2e93e920c",
		  "yanki.flac: 0a3e3f0db21aee60",
		  "yanki.flv: f869cab2efee5592",
		  "yanki.m4a: 572aacb32573b14e",
		  "yanki.mkv: 56108db32483f4ec",
		  "yanki.mov: 56028db32477b790",
		  "yanki.mp3: 565e52b324c5b1fc",
		  "yanki.mp4: 565e51b324c5b049",
		  "yanki.mpeg: 8894f1677c726e73",
		  "yanki.mpg: 565e7eb324c5fcc0",
		  "yanki.oga: 43e426b319fb46d3",
		  "yanki.ogg: 43e42cb319fb5105",
		  "yanki.ogv: 43e43bb319fb6a82",
		  "yanki.ogx: 43e43db319fb6de8",
		  "yanki.opus: 1ee4115596920b09",
		  "yanki.spx: 5214c3b29138c933",
		  "yanki.swf: 5218bfb2913cab3e",
		  "yanki.wav: 76a173b2a676ff04",
		  "yanki.webm: e7265d90c7443cab",
		  "yanki.md: ef0315138f72ff3d",
		  "yanki.pdf: f38fcc3cf590030a",
		  "yanki.avif: cac1c03fba9e53cb",
		  "yanki.gif: a0f100a5fbed16c7",
		  "yanki.ico: 1bc735a641f2833c",
		  "yanki.jpeg: 43af177b464c0595",
		  "yanki.jpg: 143104a63df46b56",
		  "yanki.png: 54a47ea5d12e12e2",
		  "yanki.svg: 3b9cf3a5c346562b",
		  "yanki.tif: 30f2d9a5bcab4682",
		  "yanki.tiff: d7eeb89f9709756c",
		  "yanki.webp: 6f750c86d78f2a55",
		  "yanki.3gp: c3c9e857a3767ec1",
		  "yanki.avi: fffbad5613424719",
		  "yanki.flv: 3a0ad756336a432f",
		  "yanki.gif: 324bce562f496a2d",
		  "yanki.mkv: dbb41455fe3fb829",
		  "yanki.mov: dba62455fe3395fd",
		  "yanki.mp4: dbfb5055fe7c20c0",
		  "yanki.mpeg: 478a291f6c63504c",
		  "yanki.mpg: dbfb2355fe7bd449",
		  "yanki.ogv: edfb765608df257b",
		  "yanki.swf: 9b54ba566b16f007",
		  "yanki.webm: ff1d08f6bf61a0f0",
		  "i am an obscenely long filename of tremendous length that will have to be truncated in a thoughtful way to preserve as much semantic value as possible.jpg: 3f8c69e608e64c11",
		  "i have so many spaces.jpg: 5bac4245655d4ba4",
		  "i.have.many.dots.jpg: 2f79041faf4149c1",
		]
	`)
})

describeWithFileFixture(
	'local media',
	{
		assetPath: './test/assets/test-media/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		it('adds local media files to anki when appropriate', { timeout: 60_000 }, async () => {
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: false,
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
		// TODO insanely slow on Windows...
		it('fetches and adds media urls to anki when appropriate', { timeout: 240_000 }, async () => {
			const results = await syncFiles(context.markdownFiles, {
				allFilePaths: context.allFiles,
				ankiConnectOptions: {
					autoLaunch: false,
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

describeWithFileFixture(
	'all media',
	{
		assetPath: './test/assets/test-media-remote/',
		cleanUpAnki: true,
		cleanUpTempFiles: true,
	},
	(context) => {
		// TODO insanely slow on Windows...
		it(
			'fetches and adds local media files and remote urls to anki when appropriate',
			{ timeout: 240_000 },
			async () => {
				const results = await syncFiles(context.markdownFiles, {
					allFilePaths: context.allFiles,
					ankiConnectOptions: {
						autoLaunch: false,
					},
					ankiWeb: false,
					dryRun: false,
					namespace: context.namespace,
					syncMediaAssets: 'all',
				})

				expect(stableResults(results)).toMatchSnapshot()
			},
		)
	},
)

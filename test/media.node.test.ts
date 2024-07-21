import { syncFiles } from '../src/lib'
import { getDefaultFileAdapter } from '../src/lib/shared/types'
import { getFileContentHash } from '../src/lib/utilities/file'
import { getFileExtensionFromUrl, getUrlContentHash } from '../src/lib/utilities/url'
import { describeWithFileFixture } from './fixtures/file-fixture'
import { stableResults } from './utilities/stable-sync-results'
import path from 'node:path'
import { expect, it } from 'vitest'

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const fetchAdapter = globalThis.fetch.bind(globalThis)

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
	'./test/assets/test-media/weird-filenames/i.have.many.dots.jpg',
	'./test/assets/test-media/weird-filenames/i am an obscenely long filename of tremendous length that will have to be truncated in a thoughtful way to preserve as much semantic value as possible.jpg',
	'./test/assets/test-media/weird-filenames/i have so many spaces.jpg',
]

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

it('gets content type extension from url metadata', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []
	for (const url of allRemoteMediaUrls) {
		const result = await getFileExtensionFromUrl(url, fetchAdapter, 'metadata')
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

it('gets content type extension from url name', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []
	for (const url of allRemoteMediaUrls) {
		const result = await getFileExtensionFromUrl(url, fetchAdapter, 'name')
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
		  "photo-1555685812-4b943f1cb0eb: unknown",
		  "photo-1574235664854-92e1da7d229a: unknown",
		]
	`)
})

it('gets content hash from url content', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []
	for (const url of allRemoteMediaUrls) {
		const result = await getUrlContentHash(url, fetchAdapter, 'content')
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
		  "photo-1555685812-4b943f1cb0eb: 1de56dd6a790ec4e",
		  "photo-1574235664854-92e1da7d229a: b957766945103e2b",
		]
	`)
})

it('gets content hash from url metadata', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []
	for (const url of allRemoteMediaUrls) {
		const result = await getUrlContentHash(url, fetchAdapter, 'metadata')
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
		  "photo-1555685812-4b943f1cb0eb: 1de56dd6a790ec4e",
		  "photo-1574235664854-92e1da7d229a: b957766945103e2b",
		]
	`)
})

it('gets content hash from url name', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []
	for (const url of allRemoteMediaUrls) {
		const result = await getUrlContentHash(url, fetchAdapter, 'name')
		const { pathname } = new URL(url)
		const key = pathname.split('/').at(-1) ?? 'undefined'
		results.push({ [key]: result ?? 'undefined' })
	}

	const compactResults = results.map(
		(entry) => `${Object.keys(entry)[0]}: ${Object.values(entry)[0]}`,
	)

	expect(compactResults).toMatchInlineSnapshot(`
		[
		  "yanki.wav: 26ab1e0f719bdfcf",
		  "yanki.png: 7cfe2d54f57a3ee5",
		  "yanki.3gp: 6bd14018c4443afe",
		  "yanki.aac: 256a1aafff4a9dd1",
		  "yanki.avi: a79e4b1a5482ef2a",
		  "yanki.flac: bbcd34162a9b0046",
		  "yanki.flv: f73cef07dede8340",
		  "yanki.m4a: a0ccfc48b55251bc",
		  "yanki.mkv: c46f9ff2d3879546",
		  "yanki.mov: 54bed64b7c2e39e2",
		  "yanki.mp3: 219ae119a8b1c84a",
		  "yanki.mp4: dd254633b3849f4d",
		  "yanki.mpeg: 2e0dfeae21e4373b",
		  "yanki.mpg: c56eca3e07d21bf6",
		  "yanki.oga: 29324706171d9173",
		  "yanki.ogg: 475e96c85c0988c5",
		  "yanki.ogv: 7d84c079ebf912fc",
		  "yanki.ogx: 8cc268204e2a955a",
		  "yanki.opus: f46459c39b688931",
		  "yanki.spx: ccfb9d7ecd7bee37",
		  "yanki.swf: 40876830998760c0",
		  "yanki.wav: 34ea10922ffd2bae",
		  "yanki.webm: 02d5e22784e0895f",
		  "yanki.avif: 130c73a3a8b07487",
		  "yanki.gif: d44e03ee20ca83cf",
		  "yanki.ico: a51724cf949fb64e",
		  "yanki.jpeg: 85798d217f9fb2bd",
		  "yanki.jpg: fabbedc65303bbf4",
		  "yanki.png: 0d8f5680b90bc188",
		  "yanki.svg: e9fba90b434aa57f",
		  "yanki.tif: f5d785cd45777e9c",
		  "yanki.tiff: 6de3614266eb3c12",
		  "yanki.webp: 9065a810eb633dfd",
		  "yanki.3gp: 73849df7c6555999",
		  "yanki.avi: e64dc515895b065d",
		  "yanki.flv: 7366724ffd19f94b",
		  "yanki.gif: 685d18b3c94fd6dd",
		  "yanki.mkv: fe5bab35ce3c8239",
		  "yanki.mov: 5c5a11046a7e558d",
		  "yanki.mp4: d32a5945331bc476",
		  "yanki.mpeg: dd0695833b5b5fd2",
		  "yanki.mpg: eae0d53adece47cd",
		  "yanki.ogv: af9156189e6bec5b",
		  "yanki.swf: 46c9fab97396b9ff",
		  "yanki.webm: 0b7fe12da14382f2",
		  "photo-1555685812-4b943f1cb0eb: 9374b988b996001d",
		  "photo-1574235664854-92e1da7d229a: 108c9ff17d0d38c1",
		]
	`)
})

it('gets content hash from file content', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []

	for (const filePath of allLocalMediaPaths) {
		const result = await getFileContentHash(filePath, await getDefaultFileAdapter(), 'content')
		const key = path.basename(filePath)
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
		  "i.have.many.dots.jpg: 2d66184d2677c1a5",
		  "i am an obscenely long filename of tremendous length that will have to be truncated in a thoughtful way to preserve as much semantic value as possible.jpg: 2d66184d2677c1a5",
		  "i have so many spaces.jpg: 2d66184d2677c1a5",
		]
	`)
})

it('gets content hash from file metadata', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []

	for (const filePath of allLocalMediaPaths) {
		const result = await getFileContentHash(filePath, await getDefaultFileAdapter(), 'metadata')
		const key = path.basename(filePath)
		results.push({ [key]: result ?? 'undefined' })
	}

	// Not stable across checkouts
	const compactResults = results.map(
		(entry) =>
			`${Object.keys(entry)[0]}: ${Object.values(entry)[0].replaceAll(/[\da-f]{16}/g, 'XXXXXXXXXXXXXXXX')}`,
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
		  "i.have.many.dots.jpg: XXXXXXXXXXXXXXXX",
		  "i am an obscenely long filename of tremendous length that will have to be truncated in a thoughtful way to preserve as much semantic value as possible.jpg: XXXXXXXXXXXXXXXX",
		  "i have so many spaces.jpg: XXXXXXXXXXXXXXXX",
		]
	`)
})

it('gets content hash from file name', { timeout: 60_000 }, async () => {
	const results: Array<Record<string, string>> = []

	for (const filePath of allLocalMediaPaths) {
		const result = await getFileContentHash(filePath, await getDefaultFileAdapter(), 'name')
		const key = path.basename(filePath)
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
		  "i.have.many.dots.jpg: 2f79041faf4149c1",
		  "i am an obscenely long filename of tremendous length that will have to be truncated in a thoughtful way to preserve as much semantic value as possible.jpg: 3f8c69e608e64c11",
		  "i have so many spaces.jpg: 5bac4245655d4ba4",
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
		// TODO insanely slow on Windows...
		it('fetches and adds media urls to anki when appropriate', { timeout: 240_000 }, async () => {
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

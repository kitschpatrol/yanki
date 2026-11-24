import { expect, it } from 'vitest'
import { extractMediaFromHtml } from '../src/lib/parse/rehype-utilities'

it('finds no media in HTML without any', () => {
	expect(extractMediaFromHtml('')).toEqual([])
	expect(
		extractMediaFromHtml('<div class="yanki"><p>Just <strong>text</strong></p></div>'),
	).toEqual([])
})

it('finds synced images and audio or video spans', () => {
	expect(
		extractMediaFromHtml(
			[
				'<p><img src="yanki-media-a.png" data-yanki-media-src="/vault/a.png" data-yanki-media-sync="true"></p>',
				'<span data-yanki-src="yanki-media-b.mp3" data-yanki-media-src="https://example.com/b.mp3" data-yanki-media-sync="true">[sound:yanki-media-b.mp3]</span>',
			].join('\n'),
		),
	).toEqual([
		{ filename: 'yanki-media-a.png', originalSrc: '/vault/a.png' },
		{ filename: 'yanki-media-b.mp3', originalSrc: 'https://example.com/b.mp3' },
	])
})

it('leaves out media that is not synced', () => {
	expect(
		extractMediaFromHtml(
			'<img src="https://example.com/a.png" data-yanki-media-src="https://example.com/a.png" data-yanki-media-sync="false">',
		),
	).toEqual([])
})

it('finds synced media whatever the case of its attributes', () => {
	expect(
		extractMediaFromHtml(
			'<IMG SRC="yanki-media-a.png" DATA-YANKI-MEDIA-SRC="/vault/a.png" DATA-YANKI-MEDIA-SYNC="true">',
		),
	).toEqual([{ filename: 'yanki-media-a.png', originalSrc: '/vault/a.png' }])
})

it('does not take text that mentions the attribute for media', () => {
	expect(extractMediaFromHtml('<p>Set data-yanki-media-sync="true" on the image.</p>')).toEqual([])
})

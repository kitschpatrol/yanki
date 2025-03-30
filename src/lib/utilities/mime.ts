import type { MediaSupportedExtension } from '../shared/constants'

/**
 * Only supports MIMEs for valid Anki media types.
 */
export function getFileExtensionForMimeType(mimeType: string): MediaSupportedExtension | undefined {
	// TODO vet these
	const mimeToExtension: Record<string, MediaSupportedExtension> = {
		'application/octet-stream': 'mp4', // Hmm
		'application/ogg': 'ogx',
		'application/pdf': 'pdf',
		'application/x-shockwave-flash': 'swf',
		'audio/aac': 'aac',
		'audio/flac': 'flac',
		'audio/mp4': 'm4a',
		'audio/mpeg': 'mp3',
		'audio/ogg': 'ogg', // 'oga'
		'audio/opus': 'opus',
		'audio/wav': 'wav',
		'audio/webm': 'webm',
		'audio/x-speex': 'spx',
		'image/avif': 'avif',
		'image/gif': 'gif',
		'image/jpeg': 'jpg', // 'jpeg'
		'image/png': 'png',
		'image/svg+xml': 'svg',
		'image/tiff': 'tif', // 'tiff'
		'image/vnd.microsoft.icon': 'ico',
		'image/webp': 'webp',
		'image/x-icon': 'ico',
		'text/markdown': 'md',
		'video/3gpp': '3gp',
		'video/flv': 'flv',
		'video/matroska': 'mkv',
		'video/mp4': 'mp4',
		'video/mpeg': 'mpg', // 'mpeg'
		'video/msvideo': 'avi',
		'video/ogg': 'ogv',
		'video/quicktime': 'mov',
		'video/webm': 'webm',
		'video/x-flv': 'flv',
		'video/x-matroska': 'mkv',
		'video/x-msvideo': 'avi',
	}

	// TMI
	// if (!(mimeType in mimeToExtension)) {
	// 	console.log(`Unknown MIME type: ${mimeType}`)
	// }

	const result = mimeToExtension[mimeType]

	// eslint-disable-next-line ts/no-unnecessary-condition
	if (result === undefined) {
		return undefined
	}

	return result
}

/**
 * Only supports MIMEs for valid Anki media types.
 * @param mimeType
 * @returns
 */
export function getFileExtensionForMimeType(mimeType: string): string | undefined {
	// TODO vet these
	const mimeToExtension: Record<string, string> = {
		'application/octet-stream': 'mp4', // Hmm
		'application/ogg': 'ogx',
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

	if (!(mimeType in mimeToExtension)) {
		console.log(`Unknown MIME type: ${mimeType}`)
	}

	return mimeToExtension[mimeType]
}

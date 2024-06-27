# Anki-compatible media asset formats

## Recommendations

- Image: `jpeg`, `png`, `svg`
- Audio: `mp3`
- Video: `mp4`, `gif`

## Official support

The Anki desktop app [source code](https://github.com/ankitects/anki/blob/e41c4573d789afe8b020fab5d9d1eede50c3fa3d/qt/aqt/editor.py#L67) indicates support for media files with the following file extensions.

> [!CAUTION]
> See the [following section](#empirical-support) for some nuances in actual support across Anki platforms.

### Image formats

`avif`, `gif`, `ico`, `jpeg`, `jpg`, `png`, `svg`, `tif`, `tiff`, `webp`

### Audio and video formats

`3gp`, `aac`, `avi`, `flac`, `flv`, `m4a`, `mkv`, `mov`, `mp3`, `mp4`, `mpeg`, `mpg`, `oga`, `ogg`, `ogv`, `ogx`, `opus`, `spx`, `swf`, `wav`, `webm`

The Anki documentation states that the [mpv library](https://mpv.io) is used internally to handle media, which should support the [formats enumerated in the ffmpeg documentation](https://ffmpeg.org//general.html#Supported-File-Formats_002c-Codecs-or-Features).

The Anki documentation also says that it will fall back to the [mplayer library](https://mplayerhq.hu/) if necessary, which supports the [formats listed here](https://mplayerhq.hu/design7/info.html).

## Empirical support

Anki client applications exist on several different platforms. In practice, full support fo the formats listed in the source code is not necessarily present across all platforms and contexts.

### Image formats

| Extension     | Anki Mac | Anki Windows | AnkiWeb | AnkiMobile (iOS) | AnkiDroid |
| ------------- | :------: | :----------: | :-----: | :--------------: | :-------: |
| `avif`        |    ✅    |      ✅      |   ✅    |        ✅        |     ?     |
| `gif`         |    ✅    |      ✅      |   ✅    |        ✅        |     ?     |
| `ico`         |    ✅    |      ✅      |   ✅    |        ✅        |     ?     |
| `jpg`, `jpeg` |    ✅    |      ✅      |   ✅    |        ✅        |     ?     |
| `png`         |    ✅    |      ✅      |   ✅    |        ✅        |     ?     |
| `svg`         |    ✅    |      ✅      |   ✅    |        ✅        |     ?     |
| `tif` `tiff`  |    ❌    |      ❌      |   ❌    |        ✅        |     ?     |
| `webp`        |    ✅    |      ✅      |   ✅    |        ✅        |     ?     |

### Audio formats

| Extension | Anki Mac | Anki Windows | AnkiWeb | AnkiMobile (iOS) | AnkiDroid |
| --------- | :------: | :----------: | :-----: | :--------------: | :-------: |
| `3gp`     |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `aac`     |    ✅    |      ✅      |   ❌    |        ✅        |     ?     |
| `avi`     |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `flac`    |    ✅    |      ✅      |   ❌    |        ✅        |     ?     |
| `flv`     |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `m4a`     |    ✅    |      ✅      |   ❌    |        ✅        |     ?     |
| `mkv`     |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `mov`     |    ✅    |      ✅      |   ❌    |       ✅\*       |     ?     |
| `mp3`     |    ✅    |      ✅      |   ✅    |        ✅        |     ?     |
| `mp4`     |    ✅    |      ✅      |   ❌    |       ✅\*       |     ?     |
| `mpeg`    |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `mpg`     |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `oga`     |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `ogg`     |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `ogv`     |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `ogx`     |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `opus`    |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `spx`     |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `swf`     |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `wav`     |    ✅    |      ✅      |   ❌    |        ✅        |     ?     |
| `webm`    |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |

\*Loads in `<video>` element.

### Video formats

| Extension    | Anki Mac | Anki Windows | AnkiWeb | AnkiMobile (iOS) | AnkiDroid |
| ------------ | :------: | :----------: | :-----: | :--------------: | :-------: |
| `avi`        |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `3gp`        |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `flv`        |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `gif`        |    ✅    |      ✅      |   ✅    |        ✅        |     ?     |
| `mkv`        |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `mov`        |    ✅    |      ✅      |   ❌    |        ✅        |     ?     |
| `mp4`        |    ✅    |      ✅      |   ❌    |        ✅        |     ?     |
| `mpg` `mpeg` |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `ogv`        |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `swf`        |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |
| `webm`       |    ✅    |      ✅      |   ❌    |        ❌        |     ?     |

### Test notes

1. It's a little lax to define media file types by their file extensions instead of a MIME type reflecting both the container and encoding, but since this is the approach Anki takes, I'll do the same.

2. I'm using the "default" Anki audio / video embedding syntax of `[sound:$filename]` to embed media in the test notes. Different markup like using HTML-native `<audio>` or `<video>` would probably improve compatibility with AnkiWeb, but in practice I found this creates other issues in the native Anki apps.

3. My test files were encoded with out-of-the-box settings in `ffmpeg`, so it's possible that encoding variations could expand or contract the compatibility matrix. For example, I'm surprised that `ogg` and `webm` proved so incompatible, so it could be an issue with my encoding technique.

4. Tested with Anki desktop apps version 24.06.2 / Qt6, and AnkiWeb with Safari 17.5 / Chrome 126. I don't have an Android device to test AnkiDroid. If anyone does, and wants to contribute their findings, feel free to send a PR.

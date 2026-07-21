# Link behavior

How Yanki parses, resolves, and renders links and embeds when converting Markdown notes to Anki cards.

Links pass through three stages:

1. **Parse** — Wiki links and Markdown links are parsed into the syntax tree (`src/lib/parse/wiki-basic/`, `remark-parse`).
2. **Resolve** — Each link target is resolved to an absolute path or URL against the set of real files (`src/lib/utilities/resolve-link.ts`, applied by `src/lib/parse/remark-resolve-links.ts`).
3. **Render** — Resolved targets become `<a href>` or media elements in the generated HTML, with metadata in `data-yanki-*` attributes (`src/lib/parse/rehype-utilities.ts`).

## Link syntaxes

| Syntax                        | Example                            | Produces                                              |
| ----------------------------- | ---------------------------------- | ----------------------------------------------------- |
| Wiki link                     | `[[Note name]]`                    | Link (`<a>`)                                          |
| Wiki link with label          | `[[Note name\|Label]]`             | Link with custom text                                 |
| Wiki embed                    | `![[image.png]]`                   | Embed for images and media; a link for notes and PDFs |
| Wiki embed with size          | `![[image.png\|300]]`, `\|300x200` | Embed with width / height                             |
| Markdown link                 | `[Label](path/to/note.md)`         | Link                                                  |
| Markdown link, angle brackets | `[Label](<path with spaces.md>)`   | Link                                                  |
| Markdown image                | `![Alt](image.png)`                | Embed                                                 |
| Autolink                      | `<https://example.com>`            | Link                                                  |
| Bare URL                      | `https://example.com` in text      | Link (GFM autolink literal)                           |
| Bare `www.` address           | `www.example.com` in text          | Link, with `http://` prepended (GFM autolink literal) |
| Bare email address            | `user@example.com` in text         | `mailto:` link (GFM autolink literal)                 |
| Raw HTML anchor               | `<a href="https://example.com">`   | Passed through untouched                              |
| Raw HTML image                | `<img src="/absolute/image.png">`  | Media handling only (see below)                       |

Notes:

- Labels: pipes are stripped from labels, matching Obsidian. Without a label, link text falls back to the last `#` anchor segment, then the last path segment, then the whole target.
- Note content transclusion is **not implemented**: `![[Some note]]` and `![[Some note#Heading]]` render as a link to the note, not the note's content inline.
- Bare URLs, `www.` addresses, and email addresses in plain text are converted to links by [GFM autolink literals](https://github.github.com/gfm/#autolinks-extension-) (`remark-gfm` runs before link resolution).
- Markdown link targets may be URI-encoded (`test%20card.md`); they are decoded before resolution.
- Raw HTML anchors are never resolved or rewritten. Raw HTML images participate in media handling, but their `src` is not resolved against the file list, so relative raw `<img>` paths are unreliable — prefer Markdown or wiki syntax, or absolute paths.

## Link target types

Every link target is classified before resolution (`getSrcType` in `src/lib/utilities/url.ts`):

| Target                | Example                            | Classification | Behavior                                                                                                                                                               |
| --------------------- | ---------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wiki name             | `[[Note name]]`                    | Name           | Matched against the file list by name, anywhere in the tree (see below)                                                                                                |
| Bare path             | `[[Cards/Note name.md]]`           | Name           | Matched against the file list by path suffix, like Obsidian's vault-root-relative links                                                                                |
| Relative path         | `[[./sibling.md]]`, `[[../up.md]]` | Path           | Resolved against the note's own directory                                                                                                                              |
| Absolute path         | `[[/Cards/Note name.md]]`          | Path           | Resolved against `basePath` (the vault root) when set, otherwise treated as volume-absolute                                                                            |
| Windows path          | `C:\Notes\card.md`                 | Path           | Normalized to forward slashes; drive-letter paths are never prepended with `basePath`                                                                                  |
| HTTP / HTTPS URL      | `https://example.com/page?a=b#c`   | URL            | Passed through completely untouched, including query strings and fragments                                                                                             |
| Obsidian URL          | `obsidian://open?vault=…&file=…`   | URL            | Passed through untouched                                                                                                                                               |
| File URL              | `file:///path/to/note.md`          | URL            | Converted to a plain path (Anki cannot open `file://` URLs); URL query strings are dropped                                                                             |
| Other protocol        | `ftp://…`, `mailto:…`              | URL            | Passed through untouched, with a console warning                                                                                                                       |
| Protocol-less web URL | `[text](www.example.com?a=b)`      | Name           | As an explicit link target, treated as a local name like standard Markdown — but bare `www.` addresses in plain text become links with `http://` prepended (see above) |

## Resolution algorithm

Name and path targets are resolved against `allFilePaths`, the list of every real file in the sync scope:

1. The target is URI-decoded and normalized (backslashes to forward slashes, `.`/`..` segments collapsed).
2. Wiki names and bare paths are matched against the file list by case-insensitive path suffix. `.md` extensions are ignored on both sides of the comparison, so `[[pandas.DataFrame.xs]]` matches `pandas.DataFrame.xs.md` even though the name looks like it already has an extension.
3. Extension-less targets are assumed to be `.md` files, matching Obsidian. For path targets, the literal path is tried first, then the path with `.md` appended.
4. If several files share the matched name, the best match is chosen: for image-like or path-containing names, files under the linking note's directory win first; then shallower paths win; then alphabetical order.
5. Matching is case-insensitive (like Obsidian), but the resolved path preserves the real file's case.
6. If nothing matches, the target falls back to plain path resolution (relative to the note's directory, or `basePath` for absolute paths) and is emitted as an absolute path even though no file exists there.

### Anchors

Obsidian anchor suffixes are supported on all local link forms:

- `[[Note#Heading]]`, `[[Note#Heading#Subheading]]` — heading anchors
- `[[Note#^abc123]]`, `[[Note^abc123]]` — block anchors

`#` and `^` are legal file name characters, so a file named `E = mc^2.md` is ambiguous with an anchor on a file named `E = mc.md`. Yanki resolves the ambiguity against the real file list: the longest literal file name interpretation is tried first, and anchor splitting only applies when no real file matches the literal reading (`getLocalPathCandidates` in `src/lib/utilities/path.ts`).

Anchor text is separated before filesystem normalization. Slashes, dot segments, backslashes, and Unicode characters in headings therefore remain anchor text and are encoded as part of the final Obsidian URL rather than being interpreted as path syntax.

Anchors are preserved in Obsidian vault URLs (encoded into the `file` parameter) and stripped from plain path output.

### Question marks and special characters

`?` is **never** an anchor or query delimiter in local link targets — it has no meaning in Obsidian links, and it's a legal file name character on macOS and Linux. A note named `How much is 2+2=?.md` links and resolves like any other file ([#20](https://github.com/kitschpatrol/yanki/issues/20)). Query strings are only meaningful in remote URLs, which pass through untouched.

In rendered HTML, resolved plain paths are URI-encoded, with literal `?` and `#` file name characters percent-encoded (`%3F`, `%23`) so the `href` parses as a path.

Note that `?` file names cannot exist on Windows, and Obsidian itself forbids `#` and `^` in note titles (though not in asset file names).

## Contexts

The same resolution logic runs everywhere; contexts differ only in which options are set:

| Context            | `allFilePaths`              | `basePath` | `obsidianVault` | Resulting link targets   |
| ------------------ | --------------------------- | ---------- | --------------- | ------------------------ |
| Obsidian plugin    | All vault files             | Vault root | Vault name      | `obsidian://` vault URLs |
| CLI (`yanki sync`) | All files in the synced dir | Not set    | Not set         | Plain absolute paths     |
| Library (Node)     | Caller-provided             | Caller's   | Caller's        | Depends on options       |
| Library (browser)  | Caller-provided (required)  | Caller's   | Caller's        | Depends on options       |

### Obsidian plugin

The [yanki-obsidian](https://github.com/kitschpatrol/yanki-obsidian) plugin passes the vault name and vault root. Links to files that exist in the vault become clickable `obsidian://open?vault=…&file=…` URLs, so cards in Anki jump back to the source note in Obsidian. The `file` parameter is the vault-root-relative path, URL-encoded (`encodeURIComponent`), with any anchor suffix included.

Protocol conversion applies to:

- All resolved **links** to existing files (notes, images, PDFs — anything in the vault)
- **Embeds** of `.md` and `.pdf` files only (media embeds stay as paths so Anki can display them)

### CLI

The `yanki sync` command resolves links against the synced directory tree but performs no protocol conversion — there is no vault to link back to. Resolved links are emitted as plain absolute paths. Absolute-style targets (`/Cards/note.md`) still match files in the synced tree by suffix, so Obsidian-flavored Markdown syncs correctly even without vault detection.

### Library

`getNoteFromMarkdown` and `syncFiles` accept `allFilePaths`, `basePath`, `obsidianVault`, and `cwd` directly. In the browser there is no file system, so `allFilePaths` must be provided for any local link resolution to work; without it, wiki names fall back to unresolvable synthetic paths.

## Embeds and media

Embeds (`![[…]]`, `![](…)`) are routed by the resolved file's extension (see [file-formats.md](./file-formats.md) for Anki's format support). Only images, audio, and video are truly embedded — Obsidian-style transclusion of note content is not implemented, so `.md` and `.pdf` embeds degrade to links:

| Embed type    | Extensions                                                                                                                        | Rendered as                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Image         | `avif` `gif` `ico` `jpeg` `jpg` `png` `svg` `tif` `tiff` `webp`                                                                   | `<img>` with optional width / height from `\|300` annotations |
| Audio / video | `3gp` `aac` `avi` `flac` `flv` `m4a` `mkv` `mov` `mp3` `mp4` `mpeg` `mpg` `oga` `ogg` `ogv` `ogx` `opus` `spx` `swf` `wav` `webm` | `<span>` with Anki's `[sound:…]` syntax                       |
| File          | `md` `pdf`                                                                                                                        | Link to the file (or Obsidian vault URL, in vault context)    |
| Unsupported   | Anything else                                                                                                                     | `<span class="yanki-media-unsupported">` containing a link    |

When `syncMediaAssets` is enabled (`local`, `remote`, or `all`; default `local`), matched media files are copied into Anki's media store under a namespaced, hashed, filesystem-safe filename, and the rendered `src` points at the stored copy. The original resolved path is always preserved in `data-yanki-media-src`. Remote (`https://`) images can also be synced into Anki's media store, with the file extension inferred from the URL or the response's content type.

## HTML output metadata

The generated HTML carries metadata for round-tripping and debugging:

- `data-yanki-src-original` — the link target before resolution, in URI-encoded form (on both links and embeds)
- `data-yanki-media-src` — the resolved absolute path or URL of a media asset
- `data-yanki-media-sync` — whether the asset is managed in Anki's media store
- `data-yanki-alt-text` — original alt text, when an embed is rendered as something other than `<img>`

## Edge cases

- **Unresolved links** — a link to a nonexistent file still renders as an `<a>` with a best-effort absolute path; no error is raised.
- **Case collisions** — matching is case-insensitive; on case-sensitive file systems two files differing only in case are distinguished by whichever sorts as the best match.
- **`file://` URLs** — converted to plain paths because Anki cannot open file URLs; any URL query string is lost in the conversion.
- **Protocol-less web addresses** — `www.example.com` is treated as a local file name, per standard Markdown semantics.
- **Windows** — `?` file names cannot exist, so `?`-literal resolution is only relevant on macOS and Linux; Windows-style input paths (backslashes, drive letters, UNC) are normalized, and extended-length paths (`\\?\…`) are passed through with a warning.

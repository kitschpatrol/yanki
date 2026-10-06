---
name: yanki
description: Create and edit Markdown flashcards for Yanki, choose the correct card syntax, and sync notes to Anki with the Yanki CLI or TypeScript library. Use when authoring Yanki notes, turning study material into cards, or troubleshooting Yanki formatting and synchronization.
license: MIT
---

# Yanki

Yanki turns Markdown files into Anki notes. Each file is one note; a reversed note or a cloze note can generate multiple cards. Markdown structure determines the note type, and folders determine the deck hierarchy.

## Choose the right tool

| Tool                                                               | When to use it                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yanki`                                                            | Author Markdown flashcards and sync a folder from the command line, or embed Markdown conversion and synchronization in a JavaScript or TypeScript application. Use the card syntax below.                                                                                                          |
| [`yanki-connect`](https://github.com/kitschpatrol/yanki-connect)   | Work directly with Anki through a typed AnkiConnect API client: query existing notes, manage decks or custom note models, change card scheduling, or build an integration with its own data and synchronization rules. It provides API access rather than Markdown conversion or folder-based sync. |
| [`yanki-obsidian`](https://github.com/kitschpatrol/yanki-obsidian) | Author and sync flashcards inside an Obsidian vault. The plugin uses Yanki's same Markdown card syntax, lets users select vault folders to sync, and turns internal links into links back to Obsidian. Prefer it when the user wants Obsidian settings and commands to manage the workflow.         |

For an existing Yanki Obsidian setup, create or edit notes in the plugin's configured folders and use its sync command. Follow the vault's existing sync configuration rather than introducing a separate CLI sync. Direct edits to Yanki-managed note content through `yanki-connect` can be overwritten by the next Markdown sync; edit the source Markdown for lasting content changes.

## Author cards

Inspect existing notes before adding files so you can follow the user's folder structure, tags, and naming conventions. Write one `.md` file per note with a descriptive filename. Keep supporting documents outside the synced directory: the CLI recursively treats every `.md` file there as a note.

When converting study material, make each prompt test a specific fact or relationship. Include enough context for the card to stand alone, keep the expected answer concise, and put explanations or sources on the back. Use reversed cards only when both directions are useful and unambiguous. Preserve the source's meaning and uncertainty.

The fenced examples below are file contents; omit the surrounding code fences when writing the actual files. Do not add labels such as `Front:` or `Back:` unless they should appear on the cards. Filenames are not automatically included in the rendered content.

### Basic: one question and answer

Separate the front and back with a horizontal rule. Leave blank lines around `---` so Markdown parses it as a rule rather than a heading underline.

```md
What is the capital of France?

---

Paris.
```

### Reversed: two directions from one note

Use two consecutive horizontal rules, separated by a blank line. This creates two cards, with the front and back exchanged. An optional third rule separates extra information shown on the answer side of both cards.

```md
The chemical symbol for oxygen

---

---

O

---

Chemical symbols are case-sensitive.
```

### Type in the answer: final emphasis

Put the answer in the final emphasis span, with a visible prompt before it. Keep the answer plain text inside `_..._`. There must be no horizontal rule in the body, and no visible content after the answer. YAML frontmatter delimiters are fine.

```md
What is the chemical symbol for oxygen?

_O_
```

### Cloze: strike through the answer

Use `~~...~~` around the text to hide. An optional final `_emphasis_` inside the strike-through provides a hint. A horizontal rule separates optional back-of-card information.

```md
The capital of France is ~~Paris _city_~~.

---

Paris is on the Seine.
```

Each cloze receives a successive number and creates its own card by default:

```md
~~Paris~~ is the capital of ~~France~~.
```

To hide multiple answers on the same card, prefix them with the same explicit one- or two-digit number:

```md
~~1 Paris~~ is the capital of ~~1 France~~.
```

Use distinct explicit numbers when separate cards need stable identities during later edits. Preserve those numbers when editing existing notes: deleting or reordering implicitly numbered clozes can associate study progress with a different answer. Removing a cloze can leave an empty card in Anki; the user can remove it with **Tools → Empty Cards**.

Clozes must occur before the first horizontal rule. They may contain inline formatting, images, or math, but cannot span multiple lines or block elements. A leading number can be interpreted as a cloze number; to hide an answer such as “12 months,” write `~~1 12 months~~`.

### Avoid accidental note types

- Strike-through before the first horizontal rule selects Cloze, even when other type cues are present. Use it intentionally.
- Without a horizontal rule, a final emphasis span with other visible text selects type-in-the-answer. Trailing italic text can therefore change the inferred type.
- A Basic note uses the first horizontal rule as the front/back split. Extra rules do not create additional notes in the same file.
- Plain Markdown without any type cue falls back to Basic with an empty-answer placeholder. Include an explicit answer when authoring question-and-answer cards.
- Use Yanki's Markdown syntax rather than native Anki `{{c1::answer}}` markup; mixing them can produce invalid notes.

## Supported Markdown

Card content supports standard Markdown plus the extensions below. The note-type cues above still apply: horizontal rules, final emphasis, and strike-through can change how the note is split or which cards are generated.

| Feature                  | Syntax and behavior                                                                                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure                | Headings such as `## Heading`, paragraphs, ordered and unordered lists, nested lists, and `> blockquotes`.                                                                                                                              |
| Inline formatting        | `**bold**`, `*italic*` or `_italic_`, and inline code in backticks. Use `~~answer~~` intentionally for cloze deletion. A single `~` does not create strike-through.                                                                     |
| GitHub Flavored Markdown | Pipe tables with a header separator row, task lists such as `- [x] Done`, and automatic links for bare web URLs and email addresses.                                                                                                    |
| Code blocks              | Fenced and indented code blocks. Add a language to the opening fence, such as `typescript`, `python`, `bash`, or `json`, for Shiki syntax highlighting. Unspecified and unsupported languages render as plain code.                     |
| Math                     | Inline `$x^2$`, display math with `$$` on separate opening and closing lines, and fenced blocks with the `math` language. Yanki converts these for Anki's built-in MathJax renderer.                                                    |
| Highlights               | `==important text==`.                                                                                                                                                                                                                   |
| GitHub alerts            | A blockquote beginning with `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, or `> [!CAUTION]`, with the message on subsequent `>` lines.                                                                                     |
| Ruby / furigana          | DenDen syntax such as `{東京\|とうきょう}` adds a reading above the base text.                                                                                                                                                          |
| Links                    | `[Label](https://example.com)`, `[Label](<path with spaces.md>)`, `[[Note name]]`, and `[[Note name\|Label]]`. Wiki links can include heading anchors (`[[Note#Heading]]`) or block anchors (`[[Note#^abc123]]`).                       |
| Media embeds             | `![Diagram](./assets/diagram.png)` or `![[diagram.png]]`. The same embed syntax supports audio and video, such as `![Audio](./assets/audio.mp3)`. Wiki embeds can specify size: `![[diagram.png\|300]]` or `![[diagram.png\|300x200]]`. |
| HTML                     | Raw HTML is supported, including inline formatting such as `<sup>2</sup>`. Prefer Markdown or wiki syntax for links and images so they participate in normal path resolution.                                                           |

By default, a single newline inside a paragraph is a soft break. Use a blank line for a new paragraph, or two trailing spaces or a backslash before a newline for a hard line break. The CLI option `--strict-line-breaks false` makes single newlines into visible line breaks.

Keep these limits in mind when adapting content from Obsidian or other Markdown tools:

- `![[Some note]]`, `![[Some note#Heading]]`, and PDF embeds become links; they do not insert the note text or PDF pages into the card.
- The Obsidian plugin turns resolved vault links into `obsidian://` links and preserves heading and block anchors. The CLI produces plain absolute file paths and strips those anchors.
- Mermaid fences render as plain code, not diagrams. Other Obsidian plugins' rendering features are not automatically available in Yanki.
- Body text such as `#topic` does not create an Anki tag. Put tags in YAML frontmatter as shown below.

## Frontmatter, decks, and media

Tags are optional YAML frontmatter at the start of the file:

```md
---
tags:
  - geography/capitals
  - review
---

What is the capital of France?

---

Paris.
```

Use string values for tags. `/` in a tag becomes Anki's `::` hierarchy separator; `::` is also accepted directly. Frontmatter is not displayed on the card.

For new notes, omit `noteId`; Yanki writes the numeric Anki ID after syncing. Preserve existing IDs and unrelated frontmatter when editing. When duplicating a file to create a different note, remove the copied `noteId`.

Choose decks by placing files in folders. Do not invent `deck`, `deckName`, or `type` frontmatter to control the CLI: it infers decks from file paths and note types from Markdown. Moving files can move their cards between decks. Keep all cards generated by one note in the same deck.

Local media is copied to Anki by default; `--sync-media all` also copies remote media. Keep relative asset paths valid from each note's directory. Media playback support varies between Anki clients; broadly compatible choices include JPEG, PNG, or SVG images, MP3 audio, and MP4 or GIF video.

## Run Yanki

Use an existing `yanki` executable, `pnpm exec yanki` for a project installation, or `pnpm dlx yanki` for a one-time invocation. The npm package's supported Node versions are `^22.18.0 || ^24.0.0 || >=26.0.0`.

Syncing requires the Anki desktop app running with the AnkiConnect add-on installed. The default connection is `http://127.0.0.1:8765`; override it with `--anki-connect` when needed. Authoring Markdown and parsing it locally do not require Anki.

### Sync the complete collection

Local Markdown is the source of truth. A sync can create, update, and **delete** Anki notes in its namespace. Notes previously synced in that namespace but missing from the current input are removed. Reuse the established root directory and namespace; syncing only a new subfolder in the same namespace can delete the other notes.

The default namespace is `Yanki`. For independent collections, use a distinct, consistent `--namespace` per collection, or sync their common parent together. Namespace names are case-insensitive. A namespace is separate from a deck: different decks can belong to the same sync group.

Preview a sync against the complete collection when establishing or changing its scope:

```sh
yanki sync ./cards --dry-run --anki-web false --json
```

A dry run plans changes without writing notes to Anki or modifying local note files. It needs a working Anki connection to compare against the actual collection; it is not an offline Markdown validator. Inspect the report for unexpected deletions or note types before applying the sync.

When syncing is within the user's request, apply the same directory and namespace:

```sh
yanki sync ./cards --anki-web false
```

These examples limit changes to local Anki. The CLI otherwise defaults to syncing AnkiWeb too; omit `--anki-web false` when that is intended. A request only to draft cards does not require running a sync.

Useful commands and options:

- `yanki list --json` lists notes in the default namespace. Use `--namespace 'Name'` for a specific collection or `--namespace '*'` to inspect all Yanki namespaces.
- `yanki sync --help` shows the installed version's options. `yanki ./cards` is shorthand for `yanki sync ./cards`.
- `--manage-filenames prompt` or `--manage-filenames response` renames local files based on their content. It defaults to `off`; renaming can break links between notes.
- `yanki delete` removes Yanki-managed notes in the selected namespace. Ordinary deletion is usually done by removing the source file and syncing the full collection.
- `yanki style --css ./cards.css --anki-web false` applies CSS to all Yanki-managed note models, across namespaces.

## Validate or integrate with the library

The ESM package exports `getNoteFromMarkdown` for conversion without connecting to Anki. Use it to check the inferred `modelName`, rendered `fields`, and `tags` before syncing. For example, in a project with `yanki` installed:

```ts
import { readFile } from 'node:fs/promises'
import { getNoteFromMarkdown } from 'yanki'

const markdown = await readFile('./cards/Geography/france-capital.md', 'utf8')
const note = await getNoteFromMarkdown(markdown, { syncMediaAssets: 'off' })
console.log(note.modelName, note.fields, note.tags)
```

`syncMediaAssets: 'off'` skips loading media for this structural check. When processing relative assets, set `cwd` to the note's directory. `getNoteFromMarkdown` leaves `deckName` empty because it has no file hierarchy to infer from.

For integrations, `syncFiles` accepts the full list of Markdown file paths, infers decks, and writes note IDs back to files. `syncNotes` accepts parsed note objects with deck names assigned by the caller; the caller manages persistence. Both operate on the complete set of notes for their namespace, with the same deletion behavior as the CLI. The library defaults `ankiWeb` to `false`.

## Further information

See the [Yanki README](https://github.com/kitschpatrol/yanki#readme) for installation instructions, the full CLI reference, advanced synchronization options, and known issues.

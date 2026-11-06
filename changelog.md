# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

(Node.js support requirements have sometimes increased in minor or patch releases.)

## [Unreleased]

### Maintenance

- Use the configured npm authentication for publishing instead of injecting a token in the release script.

## [3.2.2] - 2026-11-02

### Documentation

- Document pnpm approval and automatic skill linking, with skills CLI instructions for other package managers.

### Maintenance

- Refresh dependencies and shared configuration, build before linting, and remove automatic skills CLI preparation in favor of package-manager skill support.

## [3.2.1] - 2026-10-16

### Fixed

- Restore CLI media synchronization by replacing crypto-hash with Web Crypto SHA-256 hashing.
- Discover filtered decks without getDeckConfig and use exact deck-ID searches to locate home decks, preventing nested filtered decks from causing incorrect deck deletion.
- Show a friendly connection error and exit with status 1 when Anki is unreachable, including accurate failure reporting for dry runs.

### Maintenance

- Update to yanki-connect 5.2, refresh AnkiConnect fixtures, and add CLI and packaged filtered-deck regression tests.

## [3.2.0] - 2026-10-14

### Fixed

- Support AnkiConnect 26.x deck responses and avoid deleting descendant decks twice in a single request.
- Restore compatibility with supported browser targets by replacing unsupported Unicode-set regular-expression flags.

### Documentation

- Clarify Node.js requirements and document minimum Anki and AnkiConnect versions alongside the recommendation to use current releases.

### Maintenance

- Test Anki 26.9.3 and AnkiConnect 26.x alongside older supported releases and refresh dependencies, fixtures, and CI.

## [3.1.0] - 2026-10-06

### Added

- Provide Homebrew installation through brew install kitschpatrol/tap/yanki.
- Bundle an installable Yanki agent skill covering Markdown flashcard authoring and CLI and library synchronization.

### Changed

- **Breaking:** Restrict supported Node.js versions to ^22.18.0, ^24.0.0, or >=26.0.0.

### Documentation

- Separate CLI and library installation instructions and document Homebrew and agent-skill installation.

### Maintenance

- Automate Homebrew publishing and dependency-update pull requests and refresh dependencies and contributor tooling.

## [3.0.0] - 2026-09-15

### Changed

- **Breaking:** Require Node.js 22.18 or newer and drop Node.js 20 support.

### Documentation

- Update installation requirements for Node.js 22.18.

### Maintenance

- Refresh dependencies and GitHub Actions, update build targets, and add coverage for required Set composition methods.

## [2.0.15] - 2026-08-28

### Changed

- Hash local media contents by default instead of relying on file metadata.

### Fixed

- Include file paths and remote URLs in metadata-mode hashes so distinct media assets with identical metadata do not collide.

### Maintenance

- Refresh dependencies and CI actions, improve sitemap discovery for link checks, and revise release authentication.

## [2.0.14] - 2026-08-02

### Documentation

- Correct external documentation, package, license, and image links.

### Maintenance

- Add automated repository and website link checks, tighten release tag validation, and refresh dependencies and GitHub Actions.

## [2.0.13] - 2026-07-21

### Fixed

- Preserve slashes, dot segments, backslashes, and Unicode in Obsidian anchors by separating anchors before path normalization and encoding the final file parameter once.

### Documentation

- Explain anchor preservation and literal path disambiguation in the link behavior guide.

### Maintenance

- Update contributor tooling and expand link and anchor regression tests.

## [2.0.12] - 2026-07-19

### Fixed

- Resolve local note links containing question marks and distinguish literal filename characters from heading and block anchors using existing files.

### Documentation

- Add a guide to link parsing, resolution, anchors, embeds, media, and generated HTML metadata.

### Maintenance

- Fix a race between Node.js and browser tests and update dependency requirements.

## [2.0.11] - 2026-07-16

### Fixed

- Recover protocol default ports in urlToHostAndPort and reject invalid CLI endpoints instead of constructing host:NaN URLs.
- Skip reloading planned renamed Obsidian files during dry runs, when those paths do not yet exist.

### Maintenance

- Refresh dependencies and apply stricter TypeScript and lint checks.

## [2.0.10] - 2026-07-08

### Changed

- **Breaking:** Restrict supported Node.js versions to ^20.19.0 or >=22.12.0.

### Documentation

- Warn against mixing native Anki cloze markup with Yanki Markdown syntax and update Node.js installation guidance.

### Maintenance

- Refresh dependencies and GitHub Actions, update contributor runtime requirements, and add native-cloze regression coverage.

## [2.0.9] - 2026-05-16

### Maintenance

- Refresh dependencies and CI actions, migrate pnpm build approvals, and correctly forward npm authentication to the publish command.

## [2.0.8] - 2026-05-12

### Fixed

- Restore ES2020 bundler compatibility by initializing syntax highlighting without top-level await.

## [2.0.7] - 2026-05-12

### Fixed

- Ignore already-existing model errors when ensuring Yanki models are available.
- Normalize MIME type case and parameters and fall back to URL filenames when response types are unknown.
- Discard phantom note IDs that Anki can find but no longer resolves to note data.

### Documentation

- Use consistent AnkiConnect branding in documentation and CLI help.

### Maintenance

- Update yanki-connect.

## [2.0.6] - 2026-05-12

### Changed

- **Breaking:** Limit syntax highlighting to a selected set of common languages, using plaintext for other languages and shipping fewer grammars.

### Documentation

- Describe the narrower set of supported syntax-highlighting languages.

## [2.0.5] - 2026-05-11

### Fixed

- Separate consecutive braces in MathJax expressions so Anki does not prematurely terminate clozes containing mathematics.

### Maintenance

- Refresh dependencies, make cleanup scripts portable, and improve test determinism.

## [2.0.4] - 2026-04-06

### Changed

- **Breaking:** Raise the minimum supported Node.js version to 20.19.
- Set the default card line-height to 1.5 to match Anki's default styling.

### Fixed

- Coerce frontmatter tag values to strings before converting nested tag separators.
- Reload Anki's collection after automatic database repairs so model changes recover correctly on Windows.

### Documentation

- Add a CI status badge to the README.

### Maintenance

- Add Linux, macOS, and Windows CI with Anki fixtures, expand Windows test setup, and refresh dependencies and build configuration.

## [2.0.3] - 2026-03-01

### Fixed

- Restore media missing from Anki even when notes are unchanged, and report reuploadedMedia in synchronization results and verbose output.
- Treat base paths literally when stripping them instead of interpreting their characters as regular expressions.

### Documentation

- Correct Node.js requirements, browser fileAdapter instructions, API types, CLI help, and cloze guidance.

### Maintenance

- Refresh dependencies, update contributor runtime requirements, and expand test coverage.

## [2.0.2] - 2026-03-01

### Fixed

- Correct orphaned parent-deck detection to preserve ancestors that still contain active child decks.

## [2.0.1] - 2026-02-28

### Added

- Provide a bundled yanki/standalone export and jsDelivr and unpkg entry points for browser and CDN use.

### Changed

- Bundle CLI dependencies again while retaining the unbundled library entry point.

### Fixed

- Upload local media as base64 data through fileAdapter so synchronization works with AnkiConnect on another host.

### Maintenance

- Refresh dependencies and GitHub Actions, validate built packages, and clear the Anki test profile for more stable test runs.

## [2.0.0] - 2026-02-19

### Changed

- **Breaking:** Drop Node.js 18 support and require Node.js 20.11 or newer.
- Distribute unbundled modules with their runtime dependencies declared explicitly.

### Documentation

- Update installation guidance for the Node.js 20.11 minimum.

### Maintenance

- Replace pkgroll with tsdown, add package and type validation, refresh dependencies, and improve test reliability.

## [1.2.11] - 2026-02-18

### Fixed

- Resolve CLI file globs relative to the supplied directory so special characters in directory names are treated literally.

### Documentation

- Correct the npx example to pass a directory instead of a shell-expanded Markdown glob.

### Maintenance

- Refresh dependency requirements and add CLI path regression coverage.

## [1.2.10] - 2026-01-20

### Maintenance

- Refresh declared runtime dependencies and development tooling.

## [1.2.9] - 2025-12-08

### Maintenance

- Refresh dependencies and explicitly hoist contributor tools required by the shared configuration.

## [1.2.8] - 2025-11-25

### Documentation

- Clarify native MathJax rendering, furigana integration, and existing Obsidian heading and block-link support.

### Maintenance

- Migrate to Vitest 4 and its Playwright browser provider, revise coverage configuration, and refresh dependencies.

## [1.2.7] - 2025-11-04

### Maintenance

- Refresh dependency requirements, shared configuration, and CLI help tooling.

## [1.2.6] - 2025-10-24

### Fixed

- Generate response-mode filenames for Cloze notes from all front-field text instead of losing cloze content after the first line.

### Maintenance

- Update Yargs type definitions.

## [1.2.5] - 2025-10-23

### Fixed

- Convert strike-through to clozes only on the front of Cloze notes, preserving ordinary strike-through on the back.

### Maintenance

- Update Vite and pnpm requirements.

## [1.2.4] - 2025-10-21

### Maintenance

- Update pkgroll, Vite, and yanki-connect requirements.

## [1.2.3] - 2025-10-18

### Fixed

- Compare normalized tag sets correctly, including case differences and duplicate tags.

### Maintenance

- Load and parse local notes concurrently, simplify note equality checks, and add synchronization benchmarks.
- Refresh dependencies, remove the extra build memory flag, and update npm release authentication.

## [1.2.2] - 2025-09-30

### Fixed

- Avoid rejecting notes whose cards appear in multiple decks during filtered-deck synchronization.

## [1.2.1] - 2025-09-30

### Fixed

- Prefer the deepest matching original deck when resolving notes in filtered decks, preventing nested notes from moving to parent decks.

### Documentation

- Warn that manually splitting a note's cards across decks is unsupported and may lose study progress.

### Maintenance

- Migrate contributor lint and fix commands from kpi to ksc.

## [1.2.0] - 2025-09-29

### Added

- Support synchronization while Yanki cards are in filtered decks by identifying their original unfiltered decks.

### Fixed

- Avoid unnecessary note updates caused by differences in tag ordering.
- Restore CLI compatibility with Node.js 18 by returning to Yargs 17.

### Documentation

- Clarify API error documentation for synchronization and related operations.

### Maintenance

- Refresh dependencies and repair test utilities for filtered-deck and model-update scenarios.

## [1.1.0] - 2025-09-05

### Added

- Automatically detect and repair database problems after note-type changes, with a checkDatabase option, --check-database flag, and fixedDatabase result field.

### Fixed

- Forward strictMatching from syncFiles to note synchronization so --strict-matching takes effect.

### Documentation

- Explain empty-card cleanup and study-progress risks when deleting implicitly numbered clozes, and update known limitations.

### Maintenance

- Update dependency requirements and add model-mutation and multi-cloze regression tests.

## [1.0.2] - 2025-09-01

### Maintenance

- Refresh declared dependencies and development tooling and move dependency build approvals into pnpm workspace configuration.

## [1.0.1] - 2025-08-20

### Fixed

- Handle synchronization of an empty note collection without failing during deck-name inference.
- Update pkgroll to correct executable packaging.

### Maintenance

- Refresh dependencies, increase build memory allocation, and add filename-management and deck-collision regression tests.

## [1.0.0] - 2025-07-12

### Documentation

- Remove prerelease warnings from the README for the stable release.

### Maintenance

- Refresh dependencies and build, test, and release tooling.

## [0.18.17] - 2025-06-10

### Fixed

- Compare tags case-insensitively to match Anki's tag behavior.

### Maintenance

- Refresh dependencies, migrate Vitest workspace settings into the main configuration, and update the metadata workflow.

## [0.18.16] - 2025-06-02

### Fixed

- Resolve wiki links with omitted .md extensions correctly, including note names containing dots.

### Documentation

- Clarify Flatpak and Flathub guidance and consolidate Linux URI setup instructions.

### Maintenance

- Refresh dependency requirements and add wiki-link regression coverage.

## [0.18.15] - 2025-05-08

### Documentation

- Correct punctuation in the Linux Flatpak and Obsidian URI guidance.

## [0.18.14] - 2025-05-08

### Documentation

- Explain reported Flatpak Anki limitations affecting media synchronization and Obsidian URI links on Linux.

### Maintenance

- Replace Chalk with Picocolors, remove unused media comparison code, and refresh dependencies and tooling.

## [0.18.13] - 2025-04-28

### Fixed

- Consider the Extra field when selecting which duplicated local note retains its existing ID.
- Check media uploads on every note update so missing assets can be restored even when media references are unchanged.

### Maintenance

- Update Node.js and type-fest type requirements.

## [0.18.12] - 2025-04-27

### Fixed

- Include the Extra field when discovering, uploading, comparing, and retaining media assets.

## [0.18.11] - 2025-04-24

### Maintenance

- Refresh declared dependencies and test, build, and contributor tooling.

## [0.18.10] - 2025-03-30

### Fixed

- Reload Obsidian notes and update link-resolution paths after automatic renaming so subsequent synchronizations remain stable.

## [0.18.9] - 2025-03-30

### Fixed

- Prevent dry runs from writing note IDs to Markdown frontmatter.

### Maintenance

- Refresh dependencies and update TypeScript type-import conventions.

## [0.18.8] - 2025-03-25

### Fixed

- Parse escaped wiki-link separators correctly inside Markdown tables, following Obsidian's escape rules.

## [0.18.7] - 2025-03-24

### Fixed

- Treat number-only clozes as content instead of interpreting their entire contents as explicit cloze numbers.

### Maintenance

- Update dependency requirements and improve browser listing test reliability.

## [0.18.6] - 2025-03-22

### Fixed

- Avoid duplicate notes when their deck and note type change during the same synchronization.

### Documentation

- Correct README instructions and update AnkiConnect add-on links.

### Maintenance

- Refresh dependencies and development tooling.

## [0.18.5] - 2025-03-04

### Changed

- Expand declared Node.js 18 compatibility to 18.15 and newer within that major version.

### Maintenance

- Remove the pnpm engines requirement, correct repository metadata, and update shared configuration, Node.js types, and yanki-connect.

## [0.18.4] - 2025-03-02

### Changed

- **Breaking:** Raise the supported Node.js 20 minimum to 20.11 while retaining Node.js 18.19+ support.

### Fixed

- Pin entities to 4.5.0 to restore the distributed CLI executable.

### Documentation

- Correct the description of browser support from idempotent to isomorphic and fix README terminology.

### Maintenance

- Migrate to shared-config 5, pnpm 10, Vite 6, and Vitest 3, update build configuration, and refresh dependencies and regression fixtures.

## [0.18.3] - 2025-02-04

### Fixed

- Roll back dependency requirements to avoid the done is not a function regression.

## [0.18.2] - 2025-02-03

### Fixed

- Extract cloze content correctly when generating automatic filenames.

### Maintenance

- Refresh dependencies and add tests for cloze filenames and Obsidian vault names containing spaces.

## [0.18.1] - 2025-01-22

### Maintenance

- Refresh declared dependencies and development tooling.

## [0.18.0] - 2024-12-23

### Changed

- **Breaking:** Match orphaned notes by content within their namespace by default to recover missing note IDs; expose strictMatching and --strict-matching to require exact IDs.

### Removed

- **Breaking:** Remove the unused recreated action from synchronization result types.

### Fixed

- Remove empty YAML frontmatter when deleting its final noteId property.
- Pass the CLI strict-line-breaks setting through to synchronization.

### Documentation

- Explain recovery of missing note IDs and the strict-matching option.

### Maintenance

- Expand note ID recovery tests and serialize browser tests to avoid shared-state races.

## [0.17.0] - 2024-12-22

### Added

- Support Obsidian-style nested tags by translating slash separators to Anki's double-colon separators.

### Documentation

- Document nested tag delimiters and clarify how Yanki identifies managed notes.

### Maintenance

- Refresh dependencies, expand tag and unusual-path tests, and update the repository metadata workflow.

## [0.16.1] - 2024-11-19

### Fixed

- Accept a single string in frontmatter tags as well as an array.

### Documentation

- Expand Linux testing notes and explain the additional setup for Obsidian URI links.

### Maintenance

- Refresh dependency and tooling requirements and correct Unicode test coverage.

## [0.16.0] - 2024-09-19

### Added

- Support DenDen Markdown ruby and furigana syntax such as {東京|とうきょう}.

### Documentation

- Document furigana syntax with a rendered HTML example.

### Maintenance

- Refresh rendering dependencies and development tooling.

## [0.15.5] - 2024-09-15

### Maintenance

- Update shared configuration and yanki-connect requirements.

## [0.15.4] - 2024-09-14

### Maintenance

- Refresh dependencies and TypeScript, build, and test tooling, and revise cleanup and release scripts.

## [0.15.3] - 2024-09-07

### Maintenance

- Update shared configuration and yanki-connect requirements and adjust spell-check configuration.

## [0.15.2] - 2024-09-07

### Maintenance

- Refresh runtime dependency and development tooling requirements.

## [0.15.1] - 2024-09-02

### Fixed

- Prevent overaggressive deck pruning by checking decks individually and accounting for inconsistent Anki card-count statistics.
- Normalize generated filenames and note field and tag comparisons to avoid Unicode-related mismatches.

### Maintenance

- Run Anki tests in a dedicated profile, improve cross-platform test stability, and update Shiki.

## [0.15.0] - 2024-08-30

### Added

- Add strictLineBreaks options to choose between standard Markdown line breaks and treating single newlines as breaks.

### Documentation

- Add CLI help for configuring Markdown line-break handling.

### Maintenance

- Add remark-breaks and update Shiki.

## [0.14.1] - 2024-08-29

### Fixed

- Decode URI escapes in the text of fallback embed links.
- Avoid HTTP metadata requests for Obsidian Markdown block embeds.

### Maintenance

- Refresh declared dependencies and development tools.

## [0.14.0] - 2024-08-15

### Added

- Support shared Extra content on reversed notes, displayed on the backs of both generated cards.

### Changed

- **Breaking:** Use the Yanki - Basic (and reversed card with extra) model for reversed notes and add an optional Extra field to YankiNote.

### Fixed

- Classify notes with multiple thematic breaks correctly and recognize existing reversed-note models during synchronization.

### Documentation

- Document the syntax for shared extra content on reversed cards.

### Maintenance

- Refresh dependencies and test utilities and remove the obsolete browser development script.

## [0.13.0] - 2024-08-14

### Added

- Support explicit cloze numbers for grouping deletions on the same card, and trim surrounding whitespace from cloze content and hints.

### Documentation

- Explain automatic and explicit cloze numbering with examples and clarify inline cloze limitations.

### Maintenance

- Add Markdown template and field-masking test utilities.

## [0.12.1] - 2024-08-11

### Fixed

- Restore mathematics rendering on AnkiMobile by emitting supported inline and display MathJax delimiters.

## [0.12.0] - 2024-08-11

### Changed

- Use Anki's native MathJax markup instead of rendering mathematics in Yanki.
- **Breaking:** Support Node.js 18.19+ within Node 18 and require Node.js 20.5+ for newer major versions.

### Fixed

- Restore GFM autolinks by parsing wiki links with a Micromark extension.
- Create missing Yanki note models when updating notes and use updateNoteModel for field, tag, and note-type updates.
- Avoid secondary exceptions in CLI error handling when an error has no cause or error code.

### Documentation

- Clarify Node.js requirements and document known limitations of links after automatic renaming.

### Maintenance

- Refresh dependencies, replace the wiki parser implementation, and improve test stability.

## [0.11.1] - 2024-08-03

### Maintenance

- Align the entities requirement with rehype-raw and extend media test timeouts.

## [0.11.0] - 2024-08-03

### Added

- Preserve raw HTML in Markdown, including inline styles and images that participate in media management.

### Removed

- **Breaking:** Temporarily remove GFM autolink detection because it conflicts with wiki-link parsing.

### Fixed

- Detect visually empty cards correctly while recognizing media elements as content, and preserve custom media data attributes and target suffixes.

### Documentation

- Document the autolink limitation and mark generated HTML with a notice directing users to edit Markdown instead.

### Maintenance

- Refresh dependency requirements and update the HTML rendering pipeline.

## [0.10.0] - 2024-08-01

### Added

- Resolve Obsidian-style name-only wiki links and embeds against allFilePaths, including heading and block targets; have the CLI collect files for resolution.
- Support image width and height annotations in Markdown alt text and wiki embed labels.
- Manage PDF and Markdown media files and render links when their contents cannot be embedded.

### Changed

- Use metadata hashing by default for local media assets.
- **Breaking:** Return undefined from urlToHostAndPort for unparseable input instead of throwing, and validate AnkiConnect URLs in the CLI.

### Fixed

- Handle missing media, malformed URI escapes, and unsupported asset types without aborting note conversion, using links or placeholders where appropriate.
- Normalize paths consistently across platforms and distinguish Windows drive paths from URLs during link and media resolution.

### Documentation

- Document testing on Windows, macOS, and Linux, including the workaround used for Anki on ARM Linux.

### Maintenance

- Refresh dependencies, including yanki-connect for newer AnkiConnect releases, and expand Obsidian vault, link, media, and cross-platform tests.

## [0.9.1] - 2024-07-21

### Fixed

- Render code fences with unknown language annotations as plaintext instead of throwing Shiki errors.

### Documentation

- Correct the namespace examples and explanations in the README.

### Maintenance

- Refresh dependencies and simplify internal note ID filtering using improved type narrowing.

## [0.9.0] - 2024-07-10

### Added

- Restore the syncNotes package export with SyncNotesOptions, SyncNotesResult, and defaultSyncNotesOptions.

### Documentation

- Update Obsidian plugin references and add ki to the related projects list.

### Maintenance

- Automate browser tests with Playwright and switch coverage collection to Istanbul.

## [0.8.6] - 2024-07-09

### Documentation

- Correct the project overview and add Node.js installation guidance.

## [0.8.5] - 2024-07-09

### Changed

- **Breaking:** Raise the declared minimum Node.js version from 18 to 20.

### Documentation

- Add media format recommendations and compatibility tables for Anki desktop, AnkiWeb, and mobile clients.

### Maintenance

- Refresh dependencies and contributor tooling, including Vitest 2, and require pnpm 9 for development.

## [0.8.4] - 2024-06-26

### Fixed

- Handle Windows CLI paths, drive-letter media paths, and CRLF frontmatter correctly.

### Maintenance

- Make cleanup scripts and test fixtures usable on Windows and update Node.js type requirements.

## [0.8.3] - 2024-06-25

### Fixed

- Handle failed remote media requests and AnkiWeb synchronization gracefully when offline, reporting warnings instead of aborting local operations.

## [0.8.2] - 2024-06-25

### Fixed

- Respect basePath when inferring deck names from file paths.

### Documentation

- Correct README wording and revise the package description.

### Maintenance

- Update the Shiki rendering dependency.

## [0.8.1] - 2024-06-25

### Added

- Add a basePath option for resolving media paths against an Obsidian vault root.

## [0.8.0] - 2024-06-24

### Added

- Copy local and optionally remote images, audio, and video into Anki media storage, including wiki embeds and file URLs, with automatic cleanup and media deletion reports.
- Expose getStyle with its options and defaults to retrieve the stylesheet shared by Yanki note models.

### Changed

- **Breaking:** Replace individual file callbacks with fileAdapter options and export FileAdapter and FetchAdapter integration types.
- **Breaking:** Rename report types and formatters to Result variants, introduce SyncFilesOptions, and separate GetStyleOptions from SetStyleOptions.
- **Breaking:** Replace boolean manageFilenames and filenameMode options with manageFilenames values of off, prompt, or response.
- **Breaking:** Validate namespaces consistently across APIs, enforcing a 60-character limit and rejecting control and invisible characters while normalizing Unicode and surrounding whitespace.

### Removed

- **Breaking:** Remove syncNotes and the previous SyncOptions exports from the package entry point.

### Fixed

- Correct Obsidian vault wiki links and URI encoding for links and media paths containing spaces.
- Prevent collisions and incorrect suffix handling when automatically generated filenames are truncated.

### Documentation

- Document media synchronization, its CLI choices and limitations, and the revised public API.

### Maintenance

- Update dependencies, including yanki-connect 2, and substantially expand media, namespace, cleanup, listing, styling, and rename test coverage.

## [0.7.1] - 2024-06-19

### Fixed

- Keep YAML frontmatter values unfolded to prevent Obsidian parsing errors.
- Prevent Anki from rejecting notes whose front contains only MathJax as empty.

### Maintenance

- Update unified and Node.js type requirements and expand Markdown rendering fixtures.

## [0.7.0] - 2024-06-19

### Changed

- Update note types in place through AnkiConnect instead of deleting and recreating notes, preserving their IDs and study activity.

### Maintenance

- Update Node.js type definitions and yanki-connect requirements.

## [0.6.0] - 2024-06-18

### Changed

- **Breaking:** Split library filename configuration into a boolean manageFilenames option and a separate filenameMode of prompt or response.

### Documentation

- Update the documented syncFiles signature to include its rename callback.

## [0.5.1] - 2024-06-18

### Documentation

- Explain the rendering limitations preventing planned Mermaid diagram support.

### Maintenance

- Refresh dependency requirements and expand tests for MathJax syntax and Markdown formatting edge cases.

## [0.5.0] - 2024-06-16

### Added

- Export renameFiles and its options, defaults, and report type for filename management without synchronizing to Anki.

### Changed

- Sort synchronization results by file path and perform filename management before synchronization.

### Removed

- **Breaking:** Remove getDeckNamesFromFilePaths from the package exports.

## [0.4.1] - 2024-06-14

### Documentation

- Correct generated CLI help tables, including option aliases, filename choices, and numeric argument types.

### Maintenance

- Update shared configuration, Vite, and yanki-connect requirements.

## [0.4.0] - 2024-06-14

### Changed

- Request AnkiConnect permission before synchronization, listing, deletion, and styling operations.

### Fixed

- Report unreachable Anki instances without attempting note ID writes, and return ankiUnreachable actions from synchronization.

### Documentation

- Expand AnkiConnect installation, permission, and CORS configuration instructions.

## [0.3.1] - 2024-06-13

### Changed

- Use the first nonempty rendered text line for automatic filenames and CLI note previews.

### Fixed

- Handle filename collisions case-insensitively and remove unnecessary numeric suffixes.

### Documentation

- Document the rename callback required by browser integrations.

### Maintenance

- Replace string-strip-html with rehype-parse and hast-util-to-text for HTML text extraction.

## [0.3.0] - 2024-06-13

### Added

- Automatically name Markdown files from their prompt or response using --manage-filenames, with sanitization, collision handling, and configurable maximum length.

### Changed

- **Breaking:** Require browser integrations to supply a rename callback alongside readFile and writeFile when calling syncFiles.

### Documentation

- Document automatic filename management and its CLI options.

### Maintenance

- Update tsx and Vite requirements.

## [0.2.4] - 2024-06-13

### Documentation

- Add a README table of contents and update the documented status of duplicate note ID handling.

### Maintenance

- Refresh declared dependencies and type requirements, and update release and repository metadata workflows.

## [0.2.3] - 2024-06-07

### Documentation

- Link the README to the Yanki Obsidian plugin.

### Maintenance

- Update yanki-connect and tsx requirements.

## [0.2.2] - 2024-06-06

### Fixed

- Handle duplicated local note IDs by retaining the best matching original and assigning new IDs to the other notes.

### Maintenance

- Update yanki-connect and the GitHub release action, and reorganize AnkiConnect utilities.

## [0.2.1] - 2024-06-06

### Maintenance

- Build after bumping the release version so published output contains the updated version.

## [0.2.0] - 2024-06-06

### Changed

- **Breaking:** Rename the npm package from yanki-md to yanki.
- **Breaking:** Change the default synchronization namespace from Yanki MD to Yanki.

### Removed

- **Breaking:** Remove the yanki-md executable alias; use yanki.

### Documentation

- Update installation commands, examples, and repository links for the Yanki name.

## [0.1.1] - 2024-06-06

### Added

- Convert Markdown files into Basic, reversed, type-in-the-answer, and Cloze notes, including multiple clozes and emphasized hints.
- Render GFM tables, task lists, autolinks, highlighted code, alerts, mathematics, wiki links, and text highlights.
- Synchronize Markdown folders to nested Anki decks, persist note IDs in YAML frontmatter, synchronize tags, and remove orphaned managed notes and empty decks.
- Provide sync, list, delete, and style commands with namespace selection, dry runs, JSON and verbose reports, configurable AnkiConnect access, automatic launch, and AnkiWeb synchronization.
- Set or restore a shared CSS stylesheet for Yanki notes, with classes identifying namespaces, note types, and card sides.
- Export Markdown conversion, file and note synchronization, listing, cleanup, styling, report formatting, default options, and associated TypeScript types.
- Distribute yanki-md with yanki and yanki-md executables for Node.js 18+, plus an ESM library with browser support through custom file callbacks.

### Documentation

- Document installation, Markdown note syntax, CLI commands, namespaces, styling, library integration, and browser usage, including a browser example.

### Maintenance

- Establish build, lint, test, and release workflows, including Markdown rendering and synchronization fixtures.

[Unreleased]: https://github.com/kitschpatrol/yanki/compare/v3.2.2...HEAD
[0.1.1]: https://github.com/kitschpatrol/yanki/releases/tag/v0.1.1
[0.2.0]: https://github.com/kitschpatrol/yanki/compare/v0.1.1...v0.2.0
[0.2.1]: https://github.com/kitschpatrol/yanki/compare/v0.2.0...v0.2.1
[0.2.2]: https://github.com/kitschpatrol/yanki/compare/v0.2.1...v0.2.2
[0.2.3]: https://github.com/kitschpatrol/yanki/compare/v0.2.2...v0.2.3
[0.2.4]: https://github.com/kitschpatrol/yanki/compare/v0.2.3...v0.2.4
[0.3.0]: https://github.com/kitschpatrol/yanki/compare/v0.2.4...v0.3.0
[0.3.1]: https://github.com/kitschpatrol/yanki/compare/v0.3.0...v0.3.1
[0.4.0]: https://github.com/kitschpatrol/yanki/compare/v0.3.1...v0.4.0
[0.4.1]: https://github.com/kitschpatrol/yanki/compare/v0.4.0...v0.4.1
[0.5.0]: https://github.com/kitschpatrol/yanki/compare/v0.4.1...v0.5.0
[0.5.1]: https://github.com/kitschpatrol/yanki/compare/v0.5.0...v0.5.1
[0.6.0]: https://github.com/kitschpatrol/yanki/compare/v0.5.1...v0.6.0
[0.7.0]: https://github.com/kitschpatrol/yanki/compare/v0.6.0...v0.7.0
[0.7.1]: https://github.com/kitschpatrol/yanki/compare/v0.7.0...v0.7.1
[0.8.0]: https://github.com/kitschpatrol/yanki/compare/v0.7.1...v0.8.0
[0.8.1]: https://github.com/kitschpatrol/yanki/compare/v0.8.0...v0.8.1
[0.8.2]: https://github.com/kitschpatrol/yanki/compare/v0.8.1...v0.8.2
[0.8.3]: https://github.com/kitschpatrol/yanki/compare/v0.8.2...v0.8.3
[0.8.4]: https://github.com/kitschpatrol/yanki/compare/v0.8.3...v0.8.4
[0.8.5]: https://github.com/kitschpatrol/yanki/compare/v0.8.4...v0.8.5
[0.8.6]: https://github.com/kitschpatrol/yanki/compare/v0.8.5...v0.8.6
[0.9.0]: https://github.com/kitschpatrol/yanki/compare/v0.8.6...v0.9.0
[0.9.1]: https://github.com/kitschpatrol/yanki/compare/v0.9.0...v0.9.1
[0.10.0]: https://github.com/kitschpatrol/yanki/compare/v0.9.1...v0.10.0
[0.11.0]: https://github.com/kitschpatrol/yanki/compare/v0.10.0...v0.11.0
[0.11.1]: https://github.com/kitschpatrol/yanki/compare/v0.11.0...v0.11.1
[0.12.0]: https://github.com/kitschpatrol/yanki/compare/v0.11.1...v0.12.0
[0.12.1]: https://github.com/kitschpatrol/yanki/compare/v0.12.0...v0.12.1
[0.13.0]: https://github.com/kitschpatrol/yanki/compare/v0.12.1...v0.13.0
[0.14.0]: https://github.com/kitschpatrol/yanki/compare/v0.13.0...v0.14.0
[0.14.1]: https://github.com/kitschpatrol/yanki/compare/v0.14.0...v0.14.1
[0.15.0]: https://github.com/kitschpatrol/yanki/compare/v0.14.1...v0.15.0
[0.15.1]: https://github.com/kitschpatrol/yanki/compare/v0.15.0...v0.15.1
[0.15.2]: https://github.com/kitschpatrol/yanki/compare/v0.15.1...v0.15.2
[0.15.3]: https://github.com/kitschpatrol/yanki/compare/v0.15.2...v0.15.3
[0.15.4]: https://github.com/kitschpatrol/yanki/compare/v0.15.3...v0.15.4
[0.15.5]: https://github.com/kitschpatrol/yanki/compare/v0.15.4...v0.15.5
[0.16.0]: https://github.com/kitschpatrol/yanki/compare/v0.15.5...v0.16.0
[0.16.1]: https://github.com/kitschpatrol/yanki/compare/v0.16.0...v0.16.1
[0.17.0]: https://github.com/kitschpatrol/yanki/compare/v0.16.1...v0.17.0
[0.18.0]: https://github.com/kitschpatrol/yanki/compare/v0.17.0...v0.18.0
[0.18.1]: https://github.com/kitschpatrol/yanki/compare/v0.18.0...v0.18.1
[0.18.2]: https://github.com/kitschpatrol/yanki/compare/v0.18.1...v0.18.2
[0.18.3]: https://github.com/kitschpatrol/yanki/compare/v0.18.2...v0.18.3
[0.18.4]: https://github.com/kitschpatrol/yanki/compare/v0.18.3...v0.18.4
[0.18.5]: https://github.com/kitschpatrol/yanki/compare/v0.18.4...v0.18.5
[0.18.6]: https://github.com/kitschpatrol/yanki/compare/v0.18.5...v0.18.6
[0.18.7]: https://github.com/kitschpatrol/yanki/compare/v0.18.6...v0.18.7
[0.18.8]: https://github.com/kitschpatrol/yanki/compare/v0.18.7...v0.18.8
[0.18.9]: https://github.com/kitschpatrol/yanki/compare/v0.18.8...v0.18.9
[0.18.10]: https://github.com/kitschpatrol/yanki/compare/v0.18.9...v0.18.10
[0.18.11]: https://github.com/kitschpatrol/yanki/compare/v0.18.10...v0.18.11
[0.18.12]: https://github.com/kitschpatrol/yanki/compare/v0.18.11...v0.18.12
[0.18.13]: https://github.com/kitschpatrol/yanki/compare/v0.18.12...v0.18.13
[0.18.14]: https://github.com/kitschpatrol/yanki/compare/v0.18.13...v0.18.14
[0.18.15]: https://github.com/kitschpatrol/yanki/compare/v0.18.14...v0.18.15
[0.18.16]: https://github.com/kitschpatrol/yanki/compare/v0.18.15...v0.18.16
[0.18.17]: https://github.com/kitschpatrol/yanki/compare/v0.18.16...v0.18.17
[1.0.0]: https://github.com/kitschpatrol/yanki/compare/v0.18.17...v1.0.0
[1.0.1]: https://github.com/kitschpatrol/yanki/compare/v1.0.0...v1.0.1
[1.0.2]: https://github.com/kitschpatrol/yanki/compare/v1.0.1...v1.0.2
[1.1.0]: https://github.com/kitschpatrol/yanki/compare/v1.0.2...v1.1.0
[1.2.0]: https://github.com/kitschpatrol/yanki/compare/v1.1.0...v1.2.0
[1.2.1]: https://github.com/kitschpatrol/yanki/compare/v1.2.0...v1.2.1
[1.2.2]: https://github.com/kitschpatrol/yanki/compare/v1.2.1...v1.2.2
[1.2.3]: https://github.com/kitschpatrol/yanki/compare/v1.2.2...v1.2.3
[1.2.4]: https://github.com/kitschpatrol/yanki/compare/v1.2.3...v1.2.4
[1.2.5]: https://github.com/kitschpatrol/yanki/compare/v1.2.4...v1.2.5
[1.2.6]: https://github.com/kitschpatrol/yanki/compare/v1.2.5...v1.2.6
[1.2.7]: https://github.com/kitschpatrol/yanki/compare/v1.2.6...v1.2.7
[1.2.8]: https://github.com/kitschpatrol/yanki/compare/v1.2.7...v1.2.8
[1.2.9]: https://github.com/kitschpatrol/yanki/compare/v1.2.8...v1.2.9
[1.2.10]: https://github.com/kitschpatrol/yanki/compare/v1.2.9...v1.2.10
[1.2.11]: https://github.com/kitschpatrol/yanki/compare/v1.2.10...v1.2.11
[2.0.0]: https://github.com/kitschpatrol/yanki/compare/v1.2.11...v2.0.0
[2.0.1]: https://github.com/kitschpatrol/yanki/compare/v2.0.0...v2.0.1
[2.0.2]: https://github.com/kitschpatrol/yanki/compare/v2.0.1...v2.0.2
[2.0.3]: https://github.com/kitschpatrol/yanki/compare/v2.0.2...v2.0.3
[2.0.4]: https://github.com/kitschpatrol/yanki/compare/v2.0.3...v2.0.4
[2.0.5]: https://github.com/kitschpatrol/yanki/compare/v2.0.4...v2.0.5
[2.0.6]: https://github.com/kitschpatrol/yanki/compare/v2.0.5...v2.0.6
[2.0.7]: https://github.com/kitschpatrol/yanki/compare/v2.0.6...v2.0.7
[2.0.8]: https://github.com/kitschpatrol/yanki/compare/v2.0.7...v2.0.8
[2.0.9]: https://github.com/kitschpatrol/yanki/compare/v2.0.8...v2.0.9
[2.0.10]: https://github.com/kitschpatrol/yanki/compare/v2.0.9...v2.0.10
[2.0.11]: https://github.com/kitschpatrol/yanki/compare/v2.0.10...v2.0.11
[2.0.12]: https://github.com/kitschpatrol/yanki/compare/v2.0.11...v2.0.12
[2.0.13]: https://github.com/kitschpatrol/yanki/compare/v2.0.12...v2.0.13
[2.0.14]: https://github.com/kitschpatrol/yanki/compare/v2.0.13...v2.0.14
[2.0.15]: https://github.com/kitschpatrol/yanki/compare/v2.0.14...v2.0.15
[3.0.0]: https://github.com/kitschpatrol/yanki/compare/v2.0.15...v3.0.0
[3.1.0]: https://github.com/kitschpatrol/yanki/compare/v3.0.0...v3.1.0
[3.2.0]: https://github.com/kitschpatrol/yanki/compare/v3.1.0...v3.2.0
[3.2.1]: https://github.com/kitschpatrol/yanki/compare/v3.2.0...v3.2.1
[3.2.2]: https://github.com/kitschpatrol/yanki/compare/v3.2.1...v3.2.2

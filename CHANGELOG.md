# Changelog

All notable changes to `markdown-to-doc` should be documented in this file.

The format is based on Keep a Changelog and this project uses semantic versioning.

## [Unreleased]

## [1.1.3] - 2026-09-14

### Added

- Added task list support so GFM checklist items (`- [ ]` and `- [x]`) render as checkbox glyphs indented to their list level instead of plain bullets, including nested task items and task items inside ordered lists.
- Added raw HTML support for a fixed subset of tags (`b`, `strong`, `i`, `em`, `u`, `ins`, `s`, `del`, `strike`, `code`, `a`, `img`, `br`, `p`, `h1`-`h6`, `hr`, `ul`, `ol`, `li`), mapped onto the existing DOCX styles, with markdown allowed inside supported tags and unsupported elements dropped along with their content.
- Added unit tests for the HTML expansion helpers and converter tests for both features.
- Added `tsconfig.test.json` and wired it into the `typecheck` script so test files are type checked, which they previously were not.
- Added task list and raw HTML sections to the README and extended the example markdown to exercise both.

### Fixed

- Fixed the published CLI binary. The `bin` field pointed at `dist/cli/index.js`, but the build only bundled `src/index.ts`, so released packages shipped CLI type declarations without the executable and `npx markdown-to-doc` failed.

### Changed

- Updated the npm description and expanded the keyword list so the package is discoverable for markdown to Word and DOCX searches. Keywords take effect on the next publish.

## [1.1.2] - 2026-09-13

### Fixed

- Fixed inconsistent page counts between Word and Google Docs by writing style defaults explicitly instead of relying on the consuming renderer to supply properties for built-in style names.
- Defined `ListParagraph` with explicit indentation and contextual spacing.
- Marked `Normal` and `DefaultParagraphFont` as default styles and set body line spacing on `Normal` so every `basedOn` style inherits it.
- Populated `rPrDefault` and emitted a `w:font` entry per theme font in `fontTable.xml`.
- Always paired `w:line` with an explicit `w:lineRule`.

## [1.1.1] - 2026-05-06

### Added

- Added SVG image support for cover logos, cover images, header/footer image slots, and markdown images, including the fallback data required by `docx`.
- Added regression tests covering SVG embedding and invalid image skipping.
- Added an example SVG logo asset and updated the example script/markdown to exercise SVG rendering and skipped missing images.

### Changed

- Updated image rendering to skip assets with unsupported or mismatched image data instead of failing document generation.

## [1.1.0] - 2026-05-04

### Added

- Added standard open source project files, including `LICENSE`,
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md`.
- Added GitHub collaboration scaffolding with issue templates, a pull request
  template, CODEOWNERS, and Dependabot configuration.
- Added CLI support through the `markdown-to-doc` binary for file input, stdin, JSON config loading, and explicit help/version commands.
- Added end-to-end CLI tests covering success paths and argument/config validation.
- Added syntax-highlighted fenced code blocks in generated DOCX output using `lowlight`, with plain-text fallback for unsupported or unknown languages.

### Changed

- Updated CI workflow metadata for safer concurrency and explicit repository
  permissions.
- Updated the publish workflow to publish with npm provenance.
- Updated the README with links to project governance and contribution docs.
- Updated package build and publish metadata to ship the CLI binary.
- Updated the README with CLI installation, usage, config examples, and behavior notes.

## [1.0.1] - 2026-05-02

### Fixed

- Fixed CommonJS runtime parsing for published builds by loading `remark-parse` and `remark-gfm` with runtime `import()`.
- Fixed an issue where some CommonJS consumers could receive `Expected usable value but received an empty preset` when calling `markdownToDocx()`.

## [1.0.0] - 2026-05-02

### Added

- Initial public release of `markdown-to-doc`.
- Added `markdownToDocx(markdown, options?)` returning a DOCX `Buffer`.
- Added support for optional cover pages, table of contents, headers, footers, theme configuration, and asset resolution.
- Added support for headings, paragraphs, formatting, links, images, lists, blockquotes, code blocks, horizontal rules, and GFM tables.
- Added TypeScript types for all public configuration objects.

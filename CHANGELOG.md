# Changelog

All notable changes to `markdown-to-doc` should be documented in this file.

The format is based on Keep a Changelog and this project uses semantic versioning.

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

<p align="center">
  <img src="https://img.shields.io/badge/node-18%2B-2F5D8C?style=flat-square" alt="Node 18+" />
  <img src="https://img.shields.io/badge/output-DOCX-4C78B5?style=flat-square" alt="DOCX output" />
  <img src="https://img.shields.io/badge/types-TypeScript-C9D7E3?style=flat-square" alt="TypeScript types" />
  <img src="https://img.shields.io/badge/markdown-CommonMark%20%2B%20GFM-6B7280?style=flat-square" alt="Markdown support" />
</p>

# markdown-to-doc

`markdown-to-doc` converts Markdown into a styled `.docx` file and returns it as a `Buffer`.

It is built for application-driven document generation:

- Markdown defines the content
- configuration defines the presentation
- the package returns a DOCX buffer
- writing the file is left to the caller

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [What The Package Does](#what-the-package-does)
- [API](#api)
- [Configuration](#configuration)
  - [Top-Level Options](#top-level-options)
  - [Cover Options](#cover-options)
  - [TOC Options](#toc-options)
  - [Header And Footer Options](#header-and-footer-options)
  - [Header/Footer Slot Types](#headerfooter-slot-types)
  - [Text Style](#text-style)
  - [Page Options](#page-options)
  - [Theme Options](#theme-options)
  - [Asset Options](#asset-options)
  - [Image Sources](#image-sources)
- [Supported Markdown](#supported-markdown)
- [Behavior Notes](#behavior-notes)
- [Example Script](#example-script)
- [Errors](#errors)
- [Exports](#exports)

## Installation

```bash
npm install markdown-to-doc
```

## Quick Start

```ts
import { writeFile } from "node:fs/promises";
import { markdownToDocx } from "markdown-to-doc";

const markdown = `
# Product Objectives

Build a DOCX report from Markdown.

## Scope

- Headings
- Links
- Tables
- Images
`;

const buffer = await markdownToDocx(markdown);

await writeFile("output.docx", buffer);
```

## What The Package Does

The package takes a Markdown string and returns a fully generated DOCX file as a `Buffer`.

It supports:

- optional cover page
- optional table of contents
- configurable header and footer
- theme-based styling
- tables, links, images, lists, code blocks, and blockquotes
- private image resolution through a callback

## API

```ts
markdownToDocx(markdown: string, options?: MarkdownToDocxOptions): Promise<Buffer>
```

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `markdown` | `string` | Yes | Markdown content to render. |
| `options` | `MarkdownToDocxOptions` | No | Presentation and document configuration. |

Returns: `Promise<Buffer>`

## Configuration

### Top-Level Options

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `cover` | `CoverOptions` | `undefined` | Adds an optional cover page before the TOC and body. |
| `toc` | `TocOptions` | `undefined` | Adds an optional table of contents. |
| `header` | `HeaderFooterOptions` | `undefined` | Configures the document header. |
| `footer` | `HeaderFooterOptions` | `undefined` | Configures the document footer. |
| `page` | `PageOptions` | Built-in defaults | Controls page size, orientation, and margins. |
| `theme` | `ThemeOptions` | Built-in defaults | Controls colors, fonts, spacing, and table styling. |
| `assets` | `AssetOptions` | Built-in defaults | Controls image loading and resolution. |

### Cover Options

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `show` | `boolean` | `false` | Enables the cover page. |
| `alignment` | `"left" \| "center"` | `"center"` | Aligns the main cover text block. |
| `title` | `string` | `""` | Main cover title. |
| `subtitle` | `string` | `""` | Secondary line shown below the title. |
| `projectName` | `string` | `""` | Optional metadata line, usually project, client, or product name. |
| `date` | `string` | `""` | Optional date label. It is used exactly as provided. |
| `logo` | `ImageSource` | `undefined` | Smaller branded image near the top of the cover. |
| `logoPosition` | `"top-left" \| "top-center" \| "top-right"` | `"top-left"` | Controls the logo position. |
| `image` | `ImageSource` | `undefined` | Larger image inside the cover content. |
| `imageWidth` | `number` | `undefined` | Optional width override for the cover image, in pixels. |
| `imageHeight` | `number` | `undefined` | Optional height override for the cover image, in pixels. |
| `imagePosition` | `"aboveTitle" \| "belowTitle"` | `"aboveTitle"` | Places the cover image above or below the title block. |
| `showHeader` | `boolean` | `false` | Reuses the document header on the cover page. |
| `showFooter` | `boolean` | `false` | Reuses the document footer on the cover page. |

### TOC Options

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `show` | `boolean` | `false` | Enables the table of contents. |
| `title` | `string` | `"Table of Contents"` | Heading shown above the TOC. |
| `headingLevels` | `Array<1 \| 2 \| 3 \| 4>` | `[1, 2, 3]` | Heading levels included in the TOC. |
| `hyperlinks` | `boolean` | `true` | Makes TOC entries clickable where supported. |

### Header And Footer Options

`header` and `footer` use the same shape.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `show` | `boolean` | `false` | Enables the header or footer. |
| `left` | `HeaderFooterSlot` | `undefined` | Content in the left zone. |
| `center` | `HeaderFooterSlot` | `undefined` | Content in the center zone. |
| `right` | `HeaderFooterSlot` | `undefined` | Content in the right zone. |
| `borderTop` | `boolean` | `false` | Adds a divider line. In headers it appears below the content. In footers it appears above the content. |
| `borderColor` | `string` | Theme border color | Divider color in hex format. |

### Header/Footer Slot Types

| Slot Type | Shape | Description |
| --- | --- | --- |
| `text` | `{ type: "text"; value: string; style?: TextStyle }` | Plain text in a header or footer zone. |
| `image` | `{ type: "image"; source: ImageSource; width?: number; height?: number }` | Logo or image in a header or footer zone. |
| `pageNumber` | `{ type: "pageNumber"; format?: PageNumberFormat; style?: TextStyle }` | Current page number in one of the supported formats. |
| `link` | `{ type: "link"; text: string; url: string; style?: TextStyle }` | Clickable URL in a header or footer zone. |

Supported page number formats:

| Value | Output |
| --- | --- |
| `current` | `3` |
| `currentOfTotal` | `3 of 12` |
| `currentSlashTotal` | `3 / 12` |

### Text Style

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | `string` | Theme-dependent | Text color in hex format. |
| `font` | `string` | Theme-dependent | Font family for the slot text. |
| `size` | `number` | Theme-dependent | Font size in points. |
| `bold` | `boolean` | `false` | Renders text in bold. |
| `italics` | `boolean` | `false` | Renders text in italics. |
| `underline` | `boolean` | `false` | Underlines the text. |

### Page Options

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `size` | `"A4" \| "Letter"` | `"A4"` | Page size. |
| `orientation` | `"portrait" \| "landscape"` | `"portrait"` | Page orientation. |
| `margin.top` | `number` | `1` | Top margin in inches. |
| `margin.bottom` | `number` | `1` | Bottom margin in inches. |
| `margin.left` | `number` | `0.85` | Left margin in inches. |
| `margin.right` | `number` | `0.85` | Right margin in inches. |

### Theme Options

#### Colors

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `colors.primary` | `string` | `#2F5D8C` | Primary brand color for headings and accents. |
| `colors.secondary` | `string` | `#4C78B5` | Secondary accent color. |
| `colors.text` | `string` | `#1F2933` | Default body text color. |
| `colors.muted` | `string` | `#6B7280` | Muted text color for metadata and footer text. |
| `colors.border` | `string` | `#C9D7E3` | Border and divider color. |
| `colors.codeBg` | `string` | `#EEF4F8` | Background for inline code and code blocks. |
| `colors.quoteBg` | `string` | `#F4F8FB` | Background for blockquotes. |
| `colors.tableHeaderBg` | `string` | `#2F5D8C` | Table header background. |
| `colors.tableAltBg` | `string` | `#F6FAFD` | Alternate table row background. |

#### Fonts

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `fonts.body` | `string` | `Aptos` | Default body font. |
| `fonts.heading` | `string` | `Cambria` | Heading font. |
| `fonts.mono` | `string` | `Consolas` | Monospace font for code. |

#### Font Sizes

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `fontSize.h1` | `number` | `22` | H1 size in points. |
| `fontSize.h2` | `number` | `18` | H2 size in points. |
| `fontSize.h3` | `number` | `15` | H3 size in points. |
| `fontSize.h4` | `number` | `13` | H4 size in points. |
| `fontSize.body` | `number` | `11` | Body text size in points. |
| `fontSize.code` | `number` | `9` | Code size in points. |
| `fontSize.headerFooter` | `number` | `9` | Header and footer text size in points. |

#### Spacing

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `spacing.lineHeight` | `number` | `1.3` | Body line height multiplier. |
| `spacing.paragraphAfter` | `number` | `6` | Space after normal paragraphs, in points. |
| `spacing.headingBefore.h1` | `number` | `18` | Space before H1, in points. |
| `spacing.headingBefore.h2` | `number` | `14` | Space before H2, in points. |
| `spacing.headingBefore.h3` | `number` | `12` | Space before H3, in points. |
| `spacing.headingBefore.h4` | `number` | `10` | Space before H4, in points. |
| `spacing.headingAfter.h1` | `number` | `8` | Space after H1, in points. |
| `spacing.headingAfter.h2` | `number` | `6` | Space after H2, in points. |
| `spacing.headingAfter.h3` | `number` | `4` | Space after H3, in points. |
| `spacing.headingAfter.h4` | `number` | `4` | Space after H4, in points. |
| `spacing.sectionGap` | `number` | `12` | Gap around major separators such as horizontal rules. |

#### Tables

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `tables.striped` | `boolean` | `true` | Enables alternating row backgrounds. |
| `tables.borderColor` | `string` | `#C9D7E3` | Table border color. |
| `tables.headerBold` | `boolean` | `true` | Makes table header text bold. |

### Asset Options

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `baseDir` | `string` | `process.cwd()` | Base directory used to resolve relative Markdown image paths. |
| `resolveImage` | `(image) => Promise<ResolvedImage \| Buffer \| null \| undefined>` | Built-in no-op | Custom callback used before the built-in image resolver. |
| `fetchRemoteImages` | `boolean` | `true` | Enables built-in fetching for public `http` and `https` images. |

Use `resolveImage` when you need to:

- load private images
- sign URLs dynamically
- fetch assets from S3 or another SDK
- override image dimensions before embedding

### Image Sources

Images used in cover, header, and footer configuration support these source types:

| Source Kind | Shape | Description |
| --- | --- | --- |
| `path` | `{ kind: "path"; value: string }` | Reads an image from the filesystem. |
| `base64` | `{ kind: "base64"; value: string }` | Uses a base64-encoded image string. |
| `buffer` | `{ kind: "buffer"; value: Buffer }` | Uses an in-memory image buffer. |

## Supported Markdown

The package supports the Markdown elements most commonly used in reports and technical documents.

| Markdown Feature | Supported |
| --- | --- |
| Headings `#` to `####` | Yes |
| Paragraphs | Yes |
| Bold, italic, strikethrough | Yes |
| Inline code | Yes |
| Links | Yes |
| Images | Yes |
| Ordered lists | Yes |
| Unordered lists | Yes |
| Nested lists | Yes |
| Blockquotes | Yes |
| Fenced code blocks | Yes |
| Horizontal rules | Yes |
| GFM tables | Yes |
| Raw HTML | No |

## Behavior Notes

### Table of contents refresh

The TOC is written as a standard DOCX field. Some viewers, especially Google Docs after import, may show it as empty until the field is refreshed. This is expected behavior for field-based TOCs.

### Output behavior

The package returns a `Buffer` only. It does not write a file to disk.

### Styling model

Markdown controls the content. Configuration controls the layout and appearance.

## Example Script

The repository includes a runnable example:

```bash
bun run example
```

That script reads `examples/example.md` and writes `examples/test-output.docx`.

## Errors

Package-level failures throw `MarkdownToDocError`.

```ts
import { MarkdownToDocError } from "markdown-to-doc";
```

## Exports

The package exports:

- `markdownToDocx`
- `MarkdownToDocError`
- public TypeScript option and helper types

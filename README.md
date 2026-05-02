# markdown-to-doc

Convert Markdown into a polished `.docx` file with one function call.

`markdown-to-doc` is a TypeScript package built on top of [`docx`](https://www.npmjs.com/package/docx). It takes a Markdown string, applies a configurable theme, and returns a `Buffer` containing the generated Word document.

The core contract stays intentionally small:

```ts
import { markdownToDocx } from "markdown-to-doc";

const buffer = await markdownToDocx(markdown, options);
```

No file writing is built into the library. You decide what to do with the returned buffer.

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

const buffer = await markdownToDocx(markdown, {
  toc: { show: true },
  header: {
    show: true,
    left: { type: "text", value: "Product Requirements" },
    right: { type: "text", value: "Confidential" },
    borderTop: true,
  },
  footer: {
    show: true,
    left: { type: "pageNumber", format: "currentOfTotal" },
  },
});

await writeFile("output.docx", buffer);
```

## Run The Example

Generate a sample document locally:

```bash
bun run example
```

This writes `examples/test-output.docx`.

## Supported Markdown

The renderer supports the Markdown features that matter for technical and business documents:

- Headings `#` through `####`
- Paragraphs
- Bold, italic, strikethrough, and inline code
- Links
- Images
- Ordered and unordered lists with nesting
- Blockquotes
- Fenced code blocks
- Horizontal rules
- GFM tables

Raw HTML is not interpreted in v1.

## TOC Refresh Behavior

The table of contents is emitted as a standard DOCX field. Some viewers, especially Google Docs after import, can show it as empty until the field is refreshed. That is expected for field-based TOCs and is not a markdown rendering bug.

## API

### `markdownToDocx(markdown, options?)`

Converts Markdown into a DOCX buffer.

```ts
function markdownToDocx(
  markdown: string,
  options?: MarkdownToDocxOptions,
): Promise<Buffer>;
```

### `MarkdownToDocxOptions`

```ts
interface MarkdownToDocxOptions {
  cover?: CoverOptions;
  toc?: TocOptions;
  header?: HeaderFooterOptions;
  footer?: HeaderFooterOptions;
  page?: PageOptions;
  theme?: ThemeOptions;
  assets?: AssetOptions;
}
```

### `cover`

Optional branded cover page shown before the TOC and body.

- `show`: Enables the cover page. Default `false`.
- `alignment`: Alignment for the main cover content block. Default `center`.
- `title`: Main cover title.
- `subtitle`: Secondary line below the title.
- `projectName`: Additional metadata line.
- `date`: Additional metadata line. The package does not format dates for you.
- `logo`: Static image source for the cover.
- `logoPosition`: `top-left`, `top-center`, or `top-right`. Default `top-left`.
- `image`: Optional larger image rendered as part of the cover content.
- `imageWidth`: Optional cover image width in pixels.
- `imageHeight`: Optional cover image height in pixels.
- `imagePosition`: `aboveTitle` or `belowTitle`. Default `aboveTitle`.
- `showHeader`: Reuses the main document header on the cover. Default `false`.
- `showFooter`: Reuses the main document footer on the cover. Default `false`.

### `toc`

Optional table of contents.

- `show`: Enables the TOC. Default `false`.
- `title`: TOC heading. Default `"Table of Contents"`.
- `headingLevels`: Which heading levels to include. Default `[1, 2, 3]`.
- `hyperlinks`: Makes TOC entries clickable when supported. Default `true`.

### `header` and `footer`

The header and footer share the same shape.

```ts
interface HeaderFooterOptions {
  show?: boolean;
  left?: HeaderFooterSlot;
  center?: HeaderFooterSlot;
  right?: HeaderFooterSlot;
  borderTop?: boolean;
  borderColor?: string;
}
```

- `show`: Enables the header or footer. Default `false`.
- `left`, `center`, `right`: Independent content slots.
- `borderTop`: Adds a divider line. In headers it appears below the content; in footers it appears above the content.
- `borderColor`: Divider color. Defaults to the theme border color.

#### `HeaderFooterSlot`

```ts
type HeaderFooterSlot =
  | { type: "text"; value: string; style?: TextStyle }
  | { type: "image"; source: ImageSource; width?: number; height?: number }
  | { type: "pageNumber"; format?: PageNumberFormat; style?: TextStyle }
  | { type: "link"; text: string; url: string; style?: TextStyle };
```

- `text`: Plain text in a slot.
- `image`: Logo or other image in a slot.
- `pageNumber`: Current page, or current page plus total pages.
- `link`: Clickable URL in a slot.

#### `TextStyle`

Optional override for slot text:

- `color`: Hex text color.
- `font`: Font family.
- `size`: Font size in points.
- `bold`
- `italics`
- `underline`

### `page`

Page size and margins.

```ts
interface PageOptions {
  size?: "A4" | "Letter";
  orientation?: "portrait" | "landscape";
  margin?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}
```

Defaults:

- `size`: `A4`
- `orientation`: `portrait`
- `margin.top`: `1`
- `margin.bottom`: `1`
- `margin.left`: `1`
- `margin.right`: `1`

Margins are specified in inches.

### `theme`

Global appearance for the generated document.

```ts
interface ThemeOptions {
  colors?: {
    primary?: string;
    secondary?: string;
    text?: string;
    muted?: string;
    border?: string;
    codeBg?: string;
    quoteBg?: string;
    tableHeaderBg?: string;
    tableAltBg?: string;
  };
  fonts?: {
    body?: string;
    heading?: string;
    mono?: string;
  };
  fontSize?: {
    h1?: number;
    h2?: number;
    h3?: number;
    h4?: number;
    body?: number;
    code?: number;
    headerFooter?: number;
  };
  spacing?: {
    lineHeight?: number;
    paragraphAfter?: number;
    headingBefore?: { h1?: number; h2?: number; h3?: number; h4?: number };
    headingAfter?: { h1?: number; h2?: number; h3?: number; h4?: number };
    sectionGap?: number;
  };
  tables?: {
    striped?: boolean;
    borderColor?: string;
    headerBold?: boolean;
  };
}
```

The package ships with a report-oriented default theme, so you only need to override values that matter for your brand.

### `assets`

Asset loading behavior for Markdown images.

```ts
interface AssetOptions {
  baseDir?: string;
  resolveImage?: (
    image: ImageResolverInput,
  ) => Promise<ResolvedImage | Buffer | null | undefined>;
  fetchRemoteImages?: boolean;
}
```

- `baseDir`: Base directory for relative image paths. Default `process.cwd()`.
- `resolveImage`: Custom callback for private or transformed image retrieval.
- `fetchRemoteImages`: Enables built-in `fetch` for public `http` and `https` image URLs. Default `true`.

#### Private image example

```ts
const buffer = await markdownToDocx(markdown, {
  assets: {
    resolveImage: async ({ src }) => {
      const response = await fetch(`https://my-proxy.internal?src=${encodeURIComponent(src)}`, {
        headers: { Authorization: `Bearer ${process.env.TOKEN}` },
      });

      return { data: Buffer.from(await response.arrayBuffer()) };
    },
  },
});
```

## Default Visual Direction

The built-in defaults aim for a clean, presentation-ready document:

- strong blue heading hierarchy
- muted metadata and footer text
- light blockquote and code backgrounds
- dark table headers with readable striping
- balanced spacing for report-style documents

## Development

```bash
bun install
bun run format
bun run lint
bun run typecheck
bun test
bun run build
```

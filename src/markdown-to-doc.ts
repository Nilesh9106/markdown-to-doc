import {
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  convertMillimetersToTwip,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  type IRunOptions,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  type ParagraphChild,
  Table,
  TableCell,
  TableLayoutType,
  TableOfContents,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from "docx";
import type {
  BlockContent,
  Content,
  Heading,
  Image,
  InlineCode,
  Link,
  List,
  ListItem,
  Paragraph as MdParagraph,
  Table as MdTable,
  TableCell as MdTableCell,
  Parent,
  PhrasingContent,
  Root,
} from "mdast";
import { MarkdownToDocError } from "./errors/MarkdownToDocError.js";
import type {
  HeaderFooterSlot,
  MarkdownToDocxOptions,
  ResolvedMarkdownToDocxOptions,
  TextStyle,
} from "./types/markdown-to-doc.types.js";
import { resolveOptions } from "./utils/default-options.js";
import { resolveConfiguredImage, resolveMarkdownImage } from "./utils/image.js";
import { extractText, parseMarkdown } from "./utils/markdown.js";

type SectionChild = Paragraph | Table | TableOfContents;
type TableCellChild = Paragraph | Table;

interface RenderContext {
  options: ResolvedMarkdownToDocxOptions;
  orderedListInstance: number;
  contentWidthPx: number;
  contentWidthTwips: number;
}

const A4 = { widthMm: 210, heightMm: 297 };
const LETTER = { widthInches: 8.5, heightInches: 11 };

/**
 * Converts markdown into a styled DOCX file and returns the resulting buffer.
 *
 * @param markdown Markdown source to render.
 * @param options Optional document configuration. All fields have defaults.
 * @returns A `Buffer` containing the generated `.docx` file.
 */
export async function markdownToDocx(
  markdown: string,
  options: MarkdownToDocxOptions = {},
): Promise<Buffer> {
  if (typeof markdown !== "string") {
    throw new MarkdownToDocError("The markdown input must be a string.");
  }

  const resolvedOptions = resolveOptions(options);
  const root = parseMarkdown(markdown);
  const context = createContext(resolvedOptions);
  const document = new Document({
    numbering: {
      config: createNumberingConfig(),
    },
    sections: await buildSections(root, context),
  });

  return Packer.toBuffer(document);
}

function createContext(options: ResolvedMarkdownToDocxOptions): RenderContext {
  return {
    options,
    orderedListInstance: 1,
    contentWidthPx: calculateContentWidthPx(options),
    contentWidthTwips: calculateContentWidthTwips(options),
  };
}

async function buildSections(root: Root, context: RenderContext) {
  const sections = [];
  const page = createPageProperties(context.options);
  const mainHeaders = await buildHeaderFooter(context.options.header, context, "header");
  const mainFooters = await buildHeaderFooter(context.options.footer, context, "footer");

  if (context.options.cover.show) {
    sections.push({
      properties: {
        page,
      },
      headers: context.options.cover.showHeader ? mainHeaders : undefined,
      footers: context.options.cover.showFooter ? mainFooters : undefined,
      children: await buildCoverPage(context),
    });
  }

  const children: SectionChild[] = [];

  if (context.options.toc.show) {
    children.push(
      new Paragraph({
        text: context.options.toc.title,
        heading: HeadingLevel.HEADING_1,
        thematicBreak: true,
        spacing: {
          before: 0,
          after: toTwips(context.options.theme.spacing.headingAfter.h1),
        },
      }),
    );

    const headingLevels = [...context.options.toc.headingLevels].sort((a, b) => a - b);
    const minLevel = headingLevels[0] ?? 1;
    const maxLevel = headingLevels[headingLevels.length - 1] ?? 3;

    children.push(
      new TableOfContents(context.options.toc.title, {
        hyperlink: context.options.toc.hyperlinks,
        headingStyleRange: `${minLevel}-${maxLevel}`,
      }),
    );

    children.push(
      new Paragraph({
        children: [new PageBreak()],
      }),
    );
  }

  children.push(...(await renderBlocks(root.children as BlockContent[], context)));

  sections.push({
    properties: {
      page,
    },
    headers: mainHeaders,
    footers: mainFooters,
    children,
  });

  return sections;
}

function createPageProperties(options: ResolvedMarkdownToDocxOptions) {
  const isA4 = options.page.size === "A4";
  const portrait = options.page.orientation === "portrait";
  const pageSize = isA4
    ? {
        width: convertMillimetersToTwip(portrait ? A4.widthMm : A4.heightMm),
        height: convertMillimetersToTwip(portrait ? A4.heightMm : A4.widthMm),
      }
    : {
        width: convertInchesToTwip(portrait ? LETTER.widthInches : LETTER.heightInches),
        height: convertInchesToTwip(portrait ? LETTER.heightInches : LETTER.widthInches),
      };

  return {
    margin: {
      top: convertInchesToTwip(options.page.margin.top),
      bottom: convertInchesToTwip(options.page.margin.bottom),
      left: convertInchesToTwip(options.page.margin.left),
      right: convertInchesToTwip(options.page.margin.right),
    },
    size: pageSize,
  };
}

async function buildCoverPage(context: RenderContext): Promise<Paragraph[]> {
  const { cover, theme, assets } = context.options;
  const children: Paragraph[] = [];
  const coverAlignment = cover.alignment === "left" ? AlignmentType.LEFT : AlignmentType.CENTER;

  if (cover.logo) {
    const image = await resolveConfiguredImage(cover.logo, assets.baseDir);
    const alignment =
      cover.logoPosition === "top-center"
        ? AlignmentType.CENTER
        : cover.logoPosition === "top-right"
          ? AlignmentType.RIGHT
          : AlignmentType.LEFT;

    children.push(
      new Paragraph({
        alignment,
        spacing: {
          after: toTwips(24),
        },
        children: [
          new ImageRun({
            type: image.type,
            data: image.data,
            transformation: scaleToFit(image.width, image.height, 180),
          }),
        ],
      }),
    );
  }

  children.push(
    new Paragraph({
      spacing: {
        after: toTwips(36),
      },
    }),
  );

  if (cover.image && cover.imagePosition === "aboveTitle") {
    children.push(await createCoverImageParagraph(context));
  }

  if (cover.title) {
    children.push(
      new Paragraph({
        alignment: coverAlignment,
        heading: HeadingLevel.TITLE,
        spacing: {
          before: 0,
          after: toTwips(12),
        },
        children: [
          new TextRun({
            text: cover.title,
            bold: true,
            color: hex(theme.colors.primary),
            font: theme.fonts.heading,
            size: toHalfPoints(theme.fontSize.h1 + 8),
          }),
        ],
      }),
    );
  }

  if (cover.subtitle) {
    children.push(
      new Paragraph({
        alignment: coverAlignment,
        spacing: {
          after: toTwips(10),
        },
        children: [
          new TextRun({
            text: cover.subtitle,
            italics: true,
            color: hex(theme.colors.muted),
            font: theme.fonts.body,
            size: toHalfPoints(theme.fontSize.h3),
          }),
        ],
      }),
    );
  }

  if (cover.image && cover.imagePosition === "belowTitle") {
    children.push(await createCoverImageParagraph(context));
  }

  if (cover.projectName) {
    children.push(createMetaParagraph(cover.projectName, context, coverAlignment));
  }

  if (cover.date) {
    children.push(createMetaParagraph(cover.date, context, coverAlignment));
  }

  return children;
}

async function createCoverImageParagraph(context: RenderContext): Promise<Paragraph> {
  const { cover, assets } = context.options;

  if (!cover.image) {
    return new Paragraph({});
  }

  const image = await resolveConfiguredImage(cover.image, assets.baseDir);
  const maxWidth = Math.min(context.contentWidthPx, 420);

  return new Paragraph({
    alignment: cover.alignment === "left" ? AlignmentType.LEFT : AlignmentType.CENTER,
    spacing: {
      after: toTwips(18),
    },
    children: [
      new ImageRun({
        type: image.type,
        data: image.data,
        transformation:
          cover.imageWidth && cover.imageHeight
            ? {
                width: cover.imageWidth,
                height: cover.imageHeight,
              }
            : scaleToFit(image.width, image.height, maxWidth),
      }),
    ],
  });
}

function createMetaParagraph(
  value: string,
  context: RenderContext,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType],
): Paragraph {
  return new Paragraph({
    alignment,
    spacing: {
      after: toTwips(6),
    },
    children: [
      new TextRun({
        text: value,
        color: hex(context.options.theme.colors.muted),
        font: context.options.theme.fonts.body,
        size: toHalfPoints(context.options.theme.fontSize.body),
      }),
    ],
  });
}

async function buildHeaderFooter(
  config: ResolvedMarkdownToDocxOptions["header"],
  context: RenderContext,
  kind: "header" | "footer",
) {
  if (!config.show) {
    return undefined;
  }

  const row = new TableRow({
    children: [
      await buildHeaderFooterCell(config.left, context, AlignmentType.LEFT),
      await buildHeaderFooterCell(config.center, context, AlignmentType.CENTER),
      await buildHeaderFooterCell(config.right, context, AlignmentType.RIGHT),
    ],
  });

  const table = new Table({
    width: { size: context.contentWidthTwips, type: WidthType.DXA },
    columnWidths: createHeaderFooterColumnWidths(context.contentWidthTwips),
    layout: TableLayoutType.FIXED,
    margins: {
      top: toTwips(5),
      bottom: toTwips(5),
      left: toTwips(2),
      right: toTwips(2),
    },
    borders: {
      top: borderFor(kind === "footer" && config.borderTop, config.borderColor),
      bottom: borderFor(kind === "header" && config.borderTop, config.borderColor),
      left: borderFor(false, config.borderColor),
      right: borderFor(false, config.borderColor),
      insideHorizontal: borderFor(false, config.borderColor),
      insideVertical: borderFor(false, config.borderColor),
    },
    rows: [row],
  });

  return kind === "header"
    ? {
        default: new Header({
          children: [table],
        }),
      }
    : {
        default: new Footer({
          children: [table],
        }),
      };
}

async function buildHeaderFooterCell(
  slot: HeaderFooterSlot | undefined,
  context: RenderContext,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType],
): Promise<TableCell> {
  const children: TableCellChild[] = [
    slot ? await renderHeaderFooterSlot(slot, context, alignment) : new Paragraph({ alignment }),
  ];

  return new TableCell({
    width: {
      size: Math.floor(context.contentWidthTwips / 3),
      type: WidthType.DXA,
    },
    verticalAlign: VerticalAlign.CENTER,
    children,
  });
}

async function renderHeaderFooterSlot(
  slot: HeaderFooterSlot,
  context: RenderContext,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType],
): Promise<Paragraph> {
  const style =
    slot.type === "text" || slot.type === "link" || slot.type === "pageNumber"
      ? slot.style
      : undefined;

  if (slot.type === "image") {
    const image = await resolveConfiguredImage(slot.source, context.options.assets.baseDir);

    return new Paragraph({
      alignment,
      spacing: {
        before: toTwips(1),
        after: toTwips(1),
      },
      children: [
        new ImageRun({
          type: image.type,
          data: image.data,
          transformation:
            slot.width && slot.height
              ? { width: slot.width, height: slot.height }
              : scaleToFit(image.width, image.height, slot.width ?? 120),
        }),
      ],
    });
  }

  if (slot.type === "pageNumber") {
    return new Paragraph({
      alignment,
      spacing: {
        before: toTwips(1),
        after: toTwips(1),
      },
      children: buildPageNumberChildren(slot.format ?? "current", style, context),
    });
  }

  if (slot.type === "link") {
    return new Paragraph({
      alignment,
      spacing: {
        before: toTwips(1),
        after: toTwips(1),
      },
      children: [
        new ExternalHyperlink({
          link: slot.url,
          children: [
            createStyledRun(slot.text, style, context, {
              color: hex(context.options.theme.colors.primary),
              underline: {},
            }),
          ],
        }),
      ],
    });
  }

  return new Paragraph({
    alignment,
    spacing: {
      before: toTwips(1),
      after: toTwips(1),
    },
    children: [createStyledRun(slot.value, style, context)],
  });
}

function buildPageNumberChildren(
  format: "current" | "currentOfTotal" | "currentSlashTotal",
  style: TextStyle | undefined,
  context: RenderContext,
): ParagraphChild[] {
  const makeRun = (text: string) => createStyledRun(text, style, context);
  const current = new TextRun({
    children: [PageNumber.CURRENT],
    color: hex(style?.color ?? context.options.theme.colors.muted),
    font: style?.font ?? context.options.theme.fonts.body,
    size: toHalfPoints(style?.size ?? context.options.theme.fontSize.headerFooter),
    bold: style?.bold,
    italics: style?.italics,
    underline: style?.underline ? { type: UnderlineType.SINGLE } : undefined,
  });

  if (format === "current") {
    return [current];
  }

  const separator = format === "currentSlashTotal" ? " / " : " of ";

  return [
    current,
    makeRun(separator),
    new TextRun({
      children: [PageNumber.TOTAL_PAGES],
      color: hex(style?.color ?? context.options.theme.colors.muted),
      font: style?.font ?? context.options.theme.fonts.body,
      size: toHalfPoints(style?.size ?? context.options.theme.fontSize.headerFooter),
      bold: style?.bold,
      italics: style?.italics,
      underline: style?.underline ? { type: UnderlineType.SINGLE } : undefined,
    }),
  ];
}

function createStyledRun(
  text: string,
  style: TextStyle | undefined,
  context: RenderContext,
  extra?: Partial<IRunOptions>,
): TextRun {
  return new TextRun({
    text,
    color: hex(style?.color ?? context.options.theme.colors.muted),
    font: style?.font ?? context.options.theme.fonts.body,
    size: toHalfPoints(style?.size ?? context.options.theme.fontSize.headerFooter),
    bold: style?.bold,
    italics: style?.italics,
    underline: style?.underline ? { type: UnderlineType.SINGLE } : extra?.underline,
    ...extra,
  });
}

async function renderBlocks(
  nodes: BlockContent[],
  context: RenderContext,
): Promise<Array<Paragraph | Table>> {
  const children: Array<Paragraph | Table> = [];

  for (const node of nodes) {
    if (node.type === "heading") {
      children.push(await renderHeading(node, context));
      continue;
    }

    if (node.type === "paragraph") {
      children.push(await renderParagraph(node, context));
      continue;
    }

    if (node.type === "list") {
      children.push(...(await renderList(node, context)));
      continue;
    }

    if (node.type === "blockquote") {
      children.push(...(await renderBlockquote(node, context)));
      continue;
    }

    if (node.type === "code") {
      children.push(renderCodeBlock(node.value, node.lang, context));
      continue;
    }

    if (node.type === "thematicBreak") {
      children.push(renderHorizontalRule(context));
      continue;
    }

    if (node.type === "table") {
      children.push(await renderTable(node, context));
    }
  }

  return children;
}

async function renderHeading(node: Heading, context: RenderContext): Promise<Paragraph> {
  const level = Math.min(Math.max(node.depth, 1), 4) as 1 | 2 | 3 | 4;
  const headingMap = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
  } as const;

  return new Paragraph({
    heading: headingMap[level],
    thematicBreak: level <= 2,
    spacing: {
      before: toTwips(context.options.theme.spacing.headingBefore[`h${level}`]),
      after: toTwips(context.options.theme.spacing.headingAfter[`h${level}`]),
    },
    children: await renderInline(node.children, context, {
      bold: true,
      font: context.options.theme.fonts.heading,
      color:
        level <= 2 ? context.options.theme.colors.primary : context.options.theme.colors.secondary,
      size: toHalfPoints(context.options.theme.fontSize[`h${level}`]),
    }),
  });
}

async function renderParagraph(
  node: MdParagraph,
  context: RenderContext,
  numbering?: { reference: string; level: number; instance?: number },
): Promise<Paragraph> {
  const hasOnlyImages = node.children.every(
    (child) => child.type === "image" || (child.type === "text" && child.value.trim() === ""),
  );

  return new Paragraph({
    alignment: hasOnlyImages ? AlignmentType.CENTER : undefined,
    spacing: {
      after: toTwips(context.options.theme.spacing.paragraphAfter),
      line: toTwips(context.options.theme.fontSize.body * context.options.theme.spacing.lineHeight),
    },
    numbering,
    children: await renderInline(node.children, context, {
      font: context.options.theme.fonts.body,
      color: context.options.theme.colors.text,
      size: toHalfPoints(context.options.theme.fontSize.body),
    }),
  });
}

async function renderInline(
  nodes: PhrasingContent[],
  context: RenderContext,
  baseStyle: Partial<IRunOptions>,
): Promise<ParagraphChild[]> {
  const children: ParagraphChild[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      children.push(new TextRun({ text: node.value, ...baseStyle }));
      continue;
    }

    if (node.type === "strong") {
      children.push(
        ...(await renderInline(node.children, context, {
          ...baseStyle,
          bold: true,
        })),
      );
      continue;
    }

    if (node.type === "emphasis") {
      children.push(
        ...(await renderInline(node.children, context, {
          ...baseStyle,
          italics: true,
        })),
      );
      continue;
    }

    if (node.type === "delete") {
      children.push(
        ...(await renderInline(node.children, context, {
          ...baseStyle,
          strike: true,
        })),
      );
      continue;
    }

    if (node.type === "inlineCode") {
      children.push(renderInlineCode(node, context));
      continue;
    }

    if (node.type === "break") {
      children.push(new TextRun({ break: 1 }));
      continue;
    }

    if (node.type === "link") {
      children.push(await renderLink(node, context, baseStyle));
      continue;
    }

    if (node.type === "image") {
      children.push(await renderImage(node, context));
    }
  }

  return children;
}

function renderInlineCode(node: InlineCode, context: RenderContext): TextRun {
  return new TextRun({
    text: node.value,
    font: context.options.theme.fonts.mono,
    color: hex(context.options.theme.colors.text),
    size: toHalfPoints(context.options.theme.fontSize.code),
    shading: {
      fill: hex(context.options.theme.colors.codeBg),
    },
  });
}

async function renderLink(
  node: Link,
  context: RenderContext,
  baseStyle: Partial<IRunOptions>,
): Promise<ExternalHyperlink> {
  const linkChildren = await renderInline(node.children, context, {
    ...baseStyle,
    color: hex(context.options.theme.colors.primary),
    underline: {
      type: UnderlineType.SINGLE,
    },
  });

  return new ExternalHyperlink({
    link: node.url,
    children: linkChildren.filter(isHyperlinkChild),
  });
}

async function renderImage(node: Image, context: RenderContext): Promise<ImageRun> {
  const image = await resolveMarkdownImage(
    {
      src: node.url,
      alt: node.alt || undefined,
      title: node.title || undefined,
    },
    context.options.assets,
  );

  const maxWidth = Math.min(context.contentWidthPx, 520);

  return new ImageRun({
    type: image.type,
    data: image.data,
    transformation: scaleToFit(image.width, image.height, maxWidth),
    altText: {
      name: node.alt || "markdown-image",
      description: node.alt || "",
      title: node.title || node.alt || "",
    },
  });
}

async function renderList(node: List, context: RenderContext, depth = 0): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];
  const reference = node.ordered ? "markdown-ordered" : "markdown-bullet";
  const instance = node.ordered ? context.orderedListInstance++ : undefined;

  for (const item of node.children) {
    paragraphs.push(...(await renderListItem(item, context, reference, depth, instance)));
  }

  return paragraphs;
}

async function renderListItem(
  node: ListItem,
  context: RenderContext,
  reference: string,
  depth: number,
  instance?: number,
): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];
  let consumedNumbering = false;

  for (const child of node.children) {
    if (child.type === "list") {
      paragraphs.push(...(await renderList(child, context, depth + 1)));
      continue;
    }

    if (child.type === "paragraph") {
      paragraphs.push(
        await renderParagraph(child, context, {
          reference,
          level: Math.min(depth, 3),
          instance,
        }),
      );
      consumedNumbering = true;
      continue;
    }

    if (!consumedNumbering) {
      const fallback = new Paragraph({
        numbering: {
          reference,
          level: Math.min(depth, 3),
          instance,
        },
      });
      paragraphs.push(fallback);
      consumedNumbering = true;
    }

    if (child.type === "blockquote") {
      paragraphs.push(...(await renderBlockquote(child, context)));
      continue;
    }

    if (child.type === "code") {
      paragraphs.push(renderCodeBlock(child.value, child.lang, context));
      continue;
    }

    if (child.type === "table") {
      paragraphs.push(
        new Paragraph({
          text: extractText(child as unknown as Content),
        }),
      );
    }
  }

  return paragraphs;
}

async function renderBlockquote(node: Parent, context: RenderContext): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];

  for (const child of node.children as BlockContent[]) {
    if (child.type !== "paragraph") {
      continue;
    }

    paragraphs.push(
      new Paragraph({
        spacing: {
          after: toTwips(context.options.theme.spacing.paragraphAfter),
        },
        border: {
          left: {
            color: hex(context.options.theme.colors.primary),
            style: BorderStyle.SINGLE,
            size: 8,
          },
        },
        shading: {
          fill: hex(context.options.theme.colors.quoteBg),
        },
        indent: {
          left: toTwips(12),
        },
        children: await renderInline(child.children, context, {
          font: context.options.theme.fonts.body,
          color: context.options.theme.colors.text,
          italics: true,
          size: toHalfPoints(context.options.theme.fontSize.body),
        }),
      }),
    );
  }

  return paragraphs;
}

function renderCodeBlock(
  value: string,
  language: string | null | undefined,
  context: RenderContext,
): Paragraph {
  const prefix = language ? `${language}\n` : "";

  return new Paragraph({
    spacing: {
      after: toTwips(context.options.theme.spacing.paragraphAfter),
    },
    shading: {
      fill: hex(context.options.theme.colors.codeBg),
    },
    border: {
      left: {
        color: hex(context.options.theme.colors.border),
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
    children: [
      new TextRun({
        text: `${prefix}${value}`,
        font: context.options.theme.fonts.mono,
        color: hex(context.options.theme.colors.text),
        size: toHalfPoints(context.options.theme.fontSize.code),
      }),
    ],
  });
}

function renderHorizontalRule(context: RenderContext): Paragraph {
  return new Paragraph({
    spacing: {
      before: toTwips(context.options.theme.spacing.sectionGap),
      after: toTwips(context.options.theme.spacing.sectionGap),
    },
    border: {
      bottom: {
        color: hex(context.options.theme.colors.border),
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
  });
}

async function renderTable(node: MdTable, context: RenderContext): Promise<Table> {
  const rows = await Promise.all(
    node.children.map(async (row, rowIndex) => {
      const isHeader = rowIndex === 0;

      return new TableRow({
        tableHeader: isHeader,
        children: await Promise.all(
          row.children.map((cell, cellIndex) =>
            renderTableCell(cell, context, {
              isHeader,
              isStripedRow: !isHeader && context.options.theme.tables.striped && rowIndex % 2 === 1,
              alignment: node.align?.[cellIndex] ?? null,
            }),
          ),
        ),
      });
    }),
  );

  return new Table({
    width: {
      size: context.contentWidthTwips,
      type: WidthType.DXA,
    },
    columnWidths: createTableColumnWidths(node.children[0]?.children.length ?? 1, context),
    layout: TableLayoutType.FIXED,
    borders: {
      top: borderFor(true, context.options.theme.tables.borderColor),
      bottom: borderFor(true, context.options.theme.tables.borderColor),
      left: borderFor(true, context.options.theme.tables.borderColor),
      right: borderFor(true, context.options.theme.tables.borderColor),
      insideHorizontal: borderFor(true, context.options.theme.tables.borderColor),
      insideVertical: borderFor(true, context.options.theme.tables.borderColor),
    },
    rows,
  });
}

async function renderTableCell(
  node: MdTableCell,
  context: RenderContext,
  options: {
    isHeader: boolean;
    isStripedRow: boolean;
    alignment: "left" | "right" | "center" | null | undefined;
  },
): Promise<TableCell> {
  const children: TableCellChild[] = [
    new Paragraph({
      alignment:
        options.alignment === "center"
          ? AlignmentType.CENTER
          : options.alignment === "right"
            ? AlignmentType.RIGHT
            : AlignmentType.LEFT,
      spacing: {
        after: toTwips(2),
      },
      children: await renderInline(node.children, context, {
        font: context.options.theme.fonts.body,
        color: options.isHeader ? "FFFFFF" : context.options.theme.colors.text,
        size: toHalfPoints(context.options.theme.fontSize.body),
        bold: options.isHeader && context.options.theme.tables.headerBold,
      }),
    }),
  ];

  return new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    shading: {
      fill: options.isHeader
        ? hex(context.options.theme.colors.tableHeaderBg)
        : options.isStripedRow
          ? hex(context.options.theme.colors.tableAltBg)
          : "FFFFFF",
    },
    children,
  });
}

function createNumberingConfig() {
  return [
    {
      reference: "markdown-bullet",
      levels: [0, 1, 2, 3].map((level) => ({
        level,
        format: LevelFormat.BULLET,
        text: ["•", "◦", "▪", "–"][level] ?? "•",
        alignment: AlignmentType.START,
        style: {
          paragraph: {
            indent: {
              left: toTwips(18 + level * 18),
              hanging: toTwips(8),
            },
          },
        },
      })),
    },
    {
      reference: "markdown-ordered",
      levels: [0, 1, 2, 3].map((level) => ({
        level,
        format: LevelFormat.DECIMAL,
        text: `%${level + 1}.`,
        alignment: AlignmentType.START,
        style: {
          paragraph: {
            indent: {
              left: toTwips(18 + level * 18),
              hanging: toTwips(10),
            },
          },
        },
      })),
    },
  ];
}

function calculateContentWidthPx(options: ResolvedMarkdownToDocxOptions): number {
  const isA4 = options.page.size === "A4";
  const portrait = options.page.orientation === "portrait";
  const pageWidthInches = isA4
    ? (portrait ? A4.widthMm : A4.heightMm) / 25.4
    : portrait
      ? LETTER.widthInches
      : LETTER.heightInches;

  return Math.floor((pageWidthInches - options.page.margin.left - options.page.margin.right) * 96);
}

function calculateContentWidthTwips(options: ResolvedMarkdownToDocxOptions): number {
  const isA4 = options.page.size === "A4";
  const portrait = options.page.orientation === "portrait";
  const pageWidthTwips = isA4
    ? convertMillimetersToTwip(portrait ? A4.widthMm : A4.heightMm)
    : convertInchesToTwip(portrait ? LETTER.widthInches : LETTER.heightInches);

  return (
    pageWidthTwips -
    convertInchesToTwip(options.page.margin.left) -
    convertInchesToTwip(options.page.margin.right)
  );
}

function scaleToFit(
  width: number,
  height: number,
  maxWidth: number,
): { width: number; height: number } {
  if (width <= maxWidth) {
    return { width, height };
  }

  const ratio = maxWidth / width;

  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

function createHeaderFooterColumnWidths(contentWidthTwips: number): number[] {
  const baseWidth = Math.floor(contentWidthTwips / 3);
  const lastWidth = contentWidthTwips - baseWidth * 2;

  return [baseWidth, baseWidth, lastWidth];
}

function createTableColumnWidths(columnCount: number, context: RenderContext): number[] {
  const safeColumnCount = Math.max(columnCount, 1);
  const baseWidth = Math.floor(context.contentWidthTwips / safeColumnCount);
  const widths = Array.from({ length: safeColumnCount }, () => baseWidth);
  widths[widths.length - 1] = context.contentWidthTwips - baseWidth * (safeColumnCount - 1);

  return widths;
}

function borderFor(enabled: boolean, color: string) {
  return {
    color: hex(color),
    style: enabled ? BorderStyle.SINGLE : BorderStyle.NONE,
    size: enabled ? 6 : 0,
  };
}

function hex(value: string): string {
  return value.replace(/^#/, "").toUpperCase();
}

function toTwips(points: number): number {
  return Math.round(points * 20);
}

function toHalfPoints(points: number): number {
  return Math.round(points * 2);
}

function isHyperlinkChild(child: ParagraphChild): child is TextRun | ImageRun {
  return child instanceof TextRun || child instanceof ImageRun;
}

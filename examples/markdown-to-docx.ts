import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type MarkdownToDocxOptions, markdownToDocx } from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputPath = path.join(__dirname, "showcase.md");
const outputPath = path.join(__dirname, "showcase.docx");
const templatePath = path.join(__dirname, "template.docx");
/**
 * Builds a solid-color PNG so placeholder images are visible in the output.
 */
function solidPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (bytes: Uint8Array) =>
    (bytes.reduce((c, b) => (crcTable[(c ^ b) & 0xff] as number) ^ (c >>> 8), 0xffffffff) ^
      0xffffffff) >>>
    0;
  const chunk = (type: string, data: Uint8Array) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      const edge = x < 2 || y < 2 || x >= width - 2 || y >= height - 2;
      raw.set(edge ? [0x3d, 0x7a, 0x8e] : rgb, row + 1 + x * 3);
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", Bun.deflateSync(raw)),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

const diagramPlaceholder = solidPng(480, 240, [0xee, 0xf5, 0xf7]);
const badgePlaceholder = solidPng(120, 40, [0xc5, 0xd8, 0xde]);

const markdown = await readFile(inputPath, "utf8");

const DOCX_THEME = {
  primary: "#3D7A8E",
  secondary: "#5C95A8",
  text: "#1F2933",
  muted: "#5C7A85",
  border: "#C5D8DE",
  codeBg: "#EEF5F7",
  quoteBg: "#F2F7F8",
  tableHeaderBg: "#5C95A8",
  tableAltBg: "#F7FAFB",
} as const;

// Drop a corporate template at examples/template.docx to see style inheritance.
const hasTemplate = await access(templatePath)
  .then(() => true)
  .catch(() => false);

const template: MarkdownToDocxOptions["template"] = hasTemplate
  ? {
      source: { kind: "path", value: templatePath },
      inherit: ["styles", "numbering", "theme", "settings"],
      headers: "document",
    }
  : undefined;

const buffer = await markdownToDocx(markdown, {
  theme: {
    colors: { ...DOCX_THEME },
    fonts: {
      body: "PT Serif",
      heading: "PT Serif",
      mono: "Consolas",
    },
    fontSize: {
      h1: 22,
      h2: 18,
      h3: 15,
      h4: 13,
      body: 11,
      code: 9,
      headerFooter: 9,
    },
    spacing: {
      lineHeight: 1.3,
      paragraphAfter: 6,
      sectionGap: 12,
    },
    tables: {
      striped: true,
      borderColor: DOCX_THEME.border,
      headerBold: true,
    },
  },
  page: {
    size: "A4",
    orientation: "portrait",
    margin: {
      top: 0.8,
      bottom: 0.8,
      left: 0.75,
      right: 0.75,
    },
  },
  cover: {
    show: true,
    alignment: "center",
    title: "markdown-to-doc Feature Showcase",
    subtitle: "Every supported Markdown construct and package option in one document",
    projectName: "markdown-to-doc",
    date: new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long" }),
    logo: { kind: "path", value: path.join(__dirname, "logo.svg") },
    logoPosition: "top-center",
    showHeader: false,
    showFooter: false,
  },
  toc: {
    show: true,
    title: "Contents",
    headingLevels: [1, 2, 3],
    hyperlinks: true,
  },
  header: {
    show: true,
    left: {
      type: "image",
      source: { kind: "path", value: path.join(__dirname, "logo.svg") },
      width: 60,
    },
    center: {
      type: "text",
      value: "Feature Showcase",
      style: { color: DOCX_THEME.primary, bold: true, size: 10 },
    },
    right: {
      type: "link",
      text: "github.com/Nilesh9106/markdown-to-doc",
      url: "https://github.com/Nilesh9106/markdown-to-doc",
      style: { size: 8 },
    },
    borderTop: true,
    borderColor: DOCX_THEME.primary,
  },
  footer: {
    show: true,
    left: {
      type: "text",
      value: "Generated with markdown-to-doc",
      style: { color: DOCX_THEME.muted, italics: true },
    },
    right: {
      type: "pageNumber",
      format: "currentOfTotal",
      style: { color: DOCX_THEME.muted },
    },
    borderTop: true,
    borderColor: DOCX_THEME.primary,
  },
  assets: {
    baseDir: __dirname,
    fetchRemoteImages: false,
    // Remote images are replaced with a placeholder so the example runs offline.
    resolveImage: async ({ src }) => {
      if (src.startsWith("http://") || src.startsWith("https://")) {
        return { data: badgePlaceholder, width: 120, height: 40 };
      }

      return null;
    },
  },
  codeBlockRenderers: {
    // Swap this for a real Mermaid renderer (for example mermaid-cli or a headless browser).
    mermaid: async ({ code }) => {
      console.log(
        `Rendering mermaid diagram (${code.split("\n").length} lines) with a placeholder.`,
      );
      return { data: diagramPlaceholder, width: 480, height: 240 };
    },
  },
  template,
  deterministic: true,
});

await writeFile(outputPath, buffer);
console.log(`Wrote ${outputPath}${hasTemplate ? " using examples/template.docx" : ""}`);

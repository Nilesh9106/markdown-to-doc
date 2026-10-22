import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type MarkdownToDocxOptions, markdownToDocx } from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputPath = path.join(__dirname, "showcase.md");
const outputPath = path.join(__dirname, "showcase.docx");
const templatePath = path.join(__dirname, "template.docx");
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9l8AAAAASUVORK5CYII=",
  "base64",
);

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
        return { data: tinyPng, width: 120, height: 40 };
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
      return { data: tinyPng, width: 480, height: 240 };
    },
  },
  template,
  deterministic: true,
});

await writeFile(outputPath, buffer);
console.log(`Wrote ${outputPath}${hasTemplate ? " using examples/template.docx" : ""}`);

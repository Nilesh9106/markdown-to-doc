import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { markdownToDocx } from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.join(__dirname, "test-output.docx");
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9l8AAAAASUVORK5CYII=",
  "base64",
);

const markdown = await readFile(path.join(__dirname, "example.md"), "utf8");

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

const buffer = await markdownToDocx(markdown, {
  theme: {
    colors: { ...DOCX_THEME },
    tables: {
      borderColor: DOCX_THEME.border,
    },
    fonts: {
      body: "PT Serif",
      heading: "PT Serif",
    },
  },
  page: {
    size: "A4",
    orientation: "portrait",
    margin: {
      top: 0.63,
      bottom: 0.63,
      left: 0.63,
      right: 0.55,
    },
  },
  assets: {
    baseDir: __dirname,
    resolveImage: async ({ src }) => {
      if (src.startsWith("http://") || src.startsWith("https://")) {
        return {
          data: tinyPng,
          width: src.includes("badge") ? 120 : 480,
          height: src.includes("badge") ? 40 : 240,
        };
      }

      return null;
    },
  },
  toc: { show: false },
  header: {
    show: true,
    right: {
      type: "text",
      value: "Sample PRD",
      style: {
        color: DOCX_THEME.primary,
        bold: true,
        size: 10,
      },
    },
    borderTop: true,
    borderColor: DOCX_THEME.primary,
  },
  footer: {
    show: true,
    left: {
      type: "pageNumber",
      format: "currentOfTotal",
      style: { color: DOCX_THEME.muted },
    },
    right: {
      type: "text",
      value: "markdown-to-doc",
      style: { color: DOCX_THEME.primary },
    },
    borderTop: true,
    borderColor: DOCX_THEME.primary,
  },
  cover: {
    show: false,
    title: "Markdown to DOCX Example",
    subtitle: "Generated from the public package API",
    projectName: "markdown-to-doc",
    date: "May 2026",
    image: { kind: "buffer", value: tinyPng },
    imageWidth: 100,
    imageHeight: 100,
  },
});

await writeFile(outputPath, buffer);
console.log(`Wrote ${outputPath}`);

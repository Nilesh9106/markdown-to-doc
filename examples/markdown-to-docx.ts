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

const buffer = await markdownToDocx(markdown, {
  assets: {
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
  toc: { show: true },
  header: {
    show: true,
    left: { type: "text", value: "Sample PRD" },
    right: { type: "text", value: "Confidential" },
    borderTop: true,
  },
  footer: {
    show: true,
    left: { type: "pageNumber", format: "currentOfTotal" },
    right: { type: "text", value: "markdown-to-doc" },
    borderTop: true,
  },
  cover: {
    show: true,
    title: "Markdown to DOCX Example",
    subtitle: "Generated from the public package API",
    projectName: "markdown-to-doc",
    date: "May 2026",
    image: { kind: "buffer", value: tinyPng },
    imageWidth: 440,
    imageHeight: 180,
  },
});

await writeFile(outputPath, buffer);
console.log(`Wrote ${outputPath}`);

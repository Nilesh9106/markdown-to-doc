import { describe, expect, it } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { markdownToDocx, markdownToDocxBlob } from "../browser.js";
import { markdownToDocx as nodeMarkdownToDocx } from "../platform/node.js";

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9l8AAAAASUVORK5CYII=";
const tinyPng = Uint8Array.from(atob(tinyPngBase64), (char) => char.charCodeAt(0));

async function readDocumentXml(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const documentXml = await zip.file("word/document.xml")?.async("string");

  if (!documentXml) {
    throw new Error("Missing word/document.xml");
  }

  return documentXml;
}

describe("browser build", () => {
  it("bundles without node built-ins or process references", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "markdown-to-doc-"));
    const entry = path.join(dir, "entry.ts");
    await writeFile(entry, `export * from ${JSON.stringify(path.resolve("src/browser.ts"))};`);

    const result = await Bun.build({
      entrypoints: [entry],
      target: "browser",
      packages: "external",
    });
    const output = await result.outputs[0]?.text();

    expect(result.success).toBe(true);
    expect(output).toContain("markdownToDocx");
    expect(output).not.toMatch(/node:|\bprocess\./);
  });

  it("renders data URL and resolveImage images into Uint8Array output", async () => {
    const bytes = await markdownToDocx(
      `![inline](data:image/png;base64,${tinyPngBase64})\n\n![resolved](private://pixel.png)`,
      { assets: { resolveImage: async () => tinyPng } },
    );

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Buffer.isBuffer(bytes)).toBe(false);

    const zip = await JSZip.loadAsync(bytes);
    const media = Object.keys(zip.files).filter((name) => name.startsWith("word/media/"));

    expect(await readDocumentXml(bytes)).toContain("<w:drawing>");
    expect(media.length).toBeGreaterThan(0);
  });

  it("falls back gracefully for local image paths", async () => {
    const bytes = await markdownToDocx("Before\n\n![local](./missing.png)\n\nAfter");
    const documentXml = await readDocumentXml(bytes);

    expect(documentXml).toContain("Before");
    expect(documentXml).toContain("After");
  });

  it("matches Node output byte for byte in deterministic mode", async () => {
    const markdown = `# Title\n\n1. one\n2. two\n\n![inline](data:image/png;base64,${tinyPngBase64})`;

    const browserBytes = await markdownToDocx(markdown, { deterministic: true });
    const nodeBytes = await nodeMarkdownToDocx(markdown, { deterministic: true });

    expect(Buffer.from(browserBytes).equals(nodeBytes)).toBe(true);
  });

  it("returns a Word blob", async () => {
    const blob = await markdownToDocxBlob("# Hello");

    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(await readDocumentXml(new Uint8Array(await blob.arrayBuffer()))).toContain("Hello");
  });
});

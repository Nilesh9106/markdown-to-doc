import { describe, expect, it } from "bun:test";
import JSZip from "jszip";
import { markdownToDocx } from "../markdown-to-doc.js";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9l8AAAAASUVORK5CYII=",
  "base64",
);
const tinySvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" fill="#2563eb"/></svg>',
);

async function openDocx(buffer: Buffer): Promise<JSZip> {
  return JSZip.loadAsync(buffer);
}

async function readZipText(zip: JSZip, filePath: string): Promise<string> {
  const file = zip.file(filePath);

  if (!file) {
    throw new Error(`Missing zip entry: ${filePath}`);
  }

  return file.async("text");
}

describe("markdownToDocx", () => {
  it("generates a DOCX buffer with default options", async () => {
    const buffer = await markdownToDocx("# Hello\n\nSimple paragraph.");

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");

    const zip = await openDocx(buffer);
    const documentXml = await readZipText(zip, "word/document.xml");

    expect(documentXml).toContain("Hello");
    expect(documentXml).toContain("Simple paragraph.");
  });

  it("renders toc, header, footer, links, and tables", async () => {
    const buffer = await markdownToDocx(
      [
        "# Product Objectives",
        "",
        "Paragraph with a [project link](https://example.com).",
        "",
        "## Scope",
        "",
        "| Persona | Goal |",
        "| --- | --- |",
        "| Analyst | Fast reporting |",
      ].join("\n"),
      {
        toc: { show: true },
        header: {
          show: true,
          left: { type: "text", value: "Confidential" },
          center: { type: "text", value: "Sample PRD" },
        },
        footer: {
          show: true,
          left: { type: "pageNumber", format: "currentOfTotal" },
          right: { type: "text", value: "heizen.work" },
          borderTop: true,
        },
      },
    );

    const zip = await openDocx(buffer);
    const documentXml = await readZipText(zip, "word/document.xml");
    const headerXml = await readZipText(zip, "word/header1.xml");
    const footerXml = await readZipText(zip, "word/footer1.xml");
    const relationshipsXml = await readZipText(zip, "word/_rels/document.xml.rels");

    expect(documentXml).toContain("TOC");
    expect(documentXml).toContain("Product Objectives");
    expect(documentXml).toContain("Persona");
    expect(documentXml).toContain("Analyst");
    expect(headerXml).toContain("Confidential");
    expect(headerXml).toContain("Sample PRD");
    expect(footerXml).toContain("heizen.work");
    expect(footerXml).toContain("PAGE");
    expect(footerXml).toContain("NUMPAGES");
    expect(relationshipsXml).toContain("https://example.com");
    expect(headerXml).not.toContain('w:w="33.333%"');
    expect(footerXml).not.toContain('w:w="33.333%"');
    expect(documentXml).not.toContain('w:w="100%"');
  });

  it("renders fenced code blocks with syntax-highlighted runs", async () => {
    const buffer = await markdownToDocx(
      ["```ts", "const total = 42;", 'console.log("ready"); // keep me', "```"].join("\n"),
    );

    const zip = await openDocx(buffer);
    const documentXml = await readZipText(zip, "word/document.xml");

    expect(documentXml).toContain(">TS<");
    expect(documentXml).toContain(">const<");
    expect(documentXml).toContain(">42<");
    expect(documentXml).toContain(">console<");
    expect(documentXml).toContain(">log<");
    expect(documentXml).toContain("&quot;ready&quot;");
    expect(documentXml).toContain("// keep me");
    expect(documentXml).toContain('w:shd w:fill="EEF4F8"');
    expect(documentXml).toContain('w:color w:val="D73A49"');
    expect(documentXml).toContain('w:color w:val="005CC5"');
    expect(documentXml).toContain('w:color w:val="032F62"');
    expect(documentXml).toContain('w:color w:val="6A737D"');
  });

  it("falls back to plain code formatting for unsupported languages", async () => {
    const buffer = await markdownToDocx(
      ["```brainflux", "spark -> pulse -> sink", "```"].join("\n"),
    );

    const zip = await openDocx(buffer);
    const documentXml = await readZipText(zip, "word/document.xml");

    expect(documentXml).toContain(">BRAINFLUX<");
    expect(documentXml).toContain("spark -&gt; pulse -&gt; sink");
    expect(documentXml).toContain('w:shd w:fill="EEF4F8"');
    expect(documentXml).not.toContain('w:color w:val="1D4ED8"');
    expect(documentXml).not.toContain('w:color w:val="0F766E"');
    expect(documentXml).not.toContain('w:color w:val="B45309"');
  });

  it("uses the image resolver for markdown images", async () => {
    let resolverCalls = 0;

    const buffer = await markdownToDocx("![Private Asset](https://private.example.com/logo.png)", {
      assets: {
        resolveImage: async () => {
          resolverCalls += 1;
          return { data: tinyPng };
        },
      },
    });

    const zip = await openDocx(buffer);
    const mediaEntries = Object.keys(zip.files).filter((entry) => entry.startsWith("word/media/"));

    expect(resolverCalls).toBe(1);
    expect(mediaEntries.length).toBeGreaterThan(0);
  });

  it("embeds svg images with a docx fallback", async () => {
    const buffer = await markdownToDocx("# Title", {
      cover: {
        show: true,
        title: "SVG Cover",
        logo: { kind: "buffer", value: tinySvg },
      },
    });

    const zip = await openDocx(buffer);
    const mediaEntries = Object.keys(zip.files).filter((entry) => entry.startsWith("word/media/"));

    expect(mediaEntries.some((entry) => entry.endsWith(".svg"))).toBe(true);
    expect(mediaEntries.some((entry) => entry.endsWith(".png"))).toBe(true);
  });

  it("skips invalid images instead of throwing", async () => {
    const invalidImage = Buffer.from("not-an-image");
    const buffer = await markdownToDocx("Before ![Broken](ignored) After", {
      cover: {
        show: true,
        title: "Cover Title",
        logo: { kind: "buffer", value: invalidImage },
      },
      assets: {
        resolveImage: async () => invalidImage,
      },
    });

    const zip = await openDocx(buffer);
    const documentXml = await readZipText(zip, "word/document.xml");
    const mediaEntries = Object.keys(zip.files).filter((entry) => entry.startsWith("word/media/"));

    expect(documentXml).toContain("Cover Title");
    expect(documentXml).toContain("Before ");
    expect(documentXml).toContain(" After");
    expect(mediaEntries).toHaveLength(0);
  });

  it("renders centered cover content and embeds a cover image", async () => {
    const buffer = await markdownToDocx("# Body", {
      cover: {
        show: true,
        title: "Cover Title",
        subtitle: "Cover Subtitle",
        image: { kind: "buffer", value: tinyPng },
        imageWidth: 240,
        imageHeight: 120,
      },
    });

    const zip = await openDocx(buffer);
    const documentXml = await readZipText(zip, "word/document.xml");
    const mediaEntries = Object.keys(zip.files).filter((entry) => entry.startsWith("word/media/"));

    expect(documentXml).toContain("Cover Title");
    expect(documentXml).toContain("Cover Subtitle");
    expect(documentXml).toContain('<w:jc w:val="center"/>');
    expect(mediaEntries.length).toBeGreaterThan(0);
  });
});

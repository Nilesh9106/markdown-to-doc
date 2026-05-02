import { describe, expect, it } from "bun:test";
import JSZip from "jszip";
import { markdownToDocx } from "../markdown-to-doc.js";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9l8AAAAASUVORK5CYII=",
  "base64",
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

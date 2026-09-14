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
          right: { type: "text", value: "markdown-to-doc" },
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
    expect(footerXml).toContain("markdown-to-doc");
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
  it("emits self-contained OOXML style defaults", async () => {
    const buffer = await markdownToDocx(
      ["# Title", "", "- one", "- two", "", "`code`"].join("\n"),
      {
        theme: { fonts: { body: "PT Serif", heading: "PT Serif", mono: "Consolas" } },
      },
    );

    const zip = await openDocx(buffer);
    const stylesXml = await readZipText(zip, "word/styles.xml");
    const documentXml = await readZipText(zip, "word/document.xml");
    const fontTableXml = await readZipText(zip, "word/fontTable.xml");

    expect(stylesXml).toContain('<w:style w:type="paragraph" w:default="1" w:styleId="Normal">');
    expect(stylesXml).toContain(
      '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont">',
    );
    expect(stylesXml).toContain("<w:contextualSpacing/>");
    expect(stylesXml).toContain("<w:rPrDefault>");
    expect(stylesXml).toContain("<w:pPrDefault/>");

    const definedStyles = new Set(
      [...stylesXml.matchAll(/w:styleId="([^"]+)"/g)].map((match) => match[1]),
    );
    const referencedStyles = [
      ...stylesXml.matchAll(/w:basedOn w:val="([^"]+)"/g),
      ...documentXml.matchAll(/w:(?:p|r)Style w:val="([^"]+)"/g),
    ].map((match) => match[1]);

    for (const styleId of referencedStyles) {
      expect(definedStyles).toContain(styleId);
    }

    for (const font of new Set([...documentXml.matchAll(/w:ascii="([^"]+)"/g)].map((m) => m[1]))) {
      expect(fontTableXml).toContain(`<w:font w:name="${font}">`);
    }

    for (const part of ["word/styles.xml", "word/document.xml"]) {
      const xml = await readZipText(zip, part);

      for (const spacing of xml.match(/<w:spacing [^/]*\/>/g) ?? []) {
        if (spacing.includes("w:line=")) {
          expect(spacing).toContain('w:lineRule="auto"');
        }
      }
    }
  });
});

describe("task lists", () => {
  it("renders checked and unchecked items with checkbox glyphs", async () => {
    const buffer = await markdownToDocx("- [ ] todo item\n- [x] done item");
    const documentXml = await readZipText(await openDocx(buffer), "word/document.xml");

    expect(documentXml).toContain("☐ ");
    expect(documentXml).toContain("☑ ");
    expect(documentXml).toContain("todo item");
    expect(documentXml).toContain("done item");
  });

  it("renders nested task items with deeper indentation", async () => {
    const buffer = await markdownToDocx("- [ ] parent\n  - [x] child");
    const documentXml = await readZipText(await openDocx(buffer), "word/document.xml");
    const indents = [...documentXml.matchAll(/<w:ind w:left="(\d+)"/g)].map((match) =>
      Number(match[1]),
    );

    expect(documentXml).toContain("parent");
    expect(documentXml).toContain("child");
    expect(indents.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...indents)).toBeGreaterThan(Math.min(...indents));
  });

  it("keeps inline formatting inside a task item", async () => {
    const buffer = await markdownToDocx("- [x] ship **the** release");
    const documentXml = await readZipText(await openDocx(buffer), "word/document.xml");

    expect(documentXml).toContain("☑ ");
    expect(documentXml).toContain("<w:b/>");
    expect(documentXml).toContain("release");
  });

  it("supports task items inside ordered lists", async () => {
    const buffer = await markdownToDocx("1. [ ] first task\n2. [x] second task");
    const documentXml = await readZipText(await openDocx(buffer), "word/document.xml");

    expect(documentXml).toContain("☐ ");
    expect(documentXml).toContain("☑ ");
    expect(documentXml).toContain("first task");
    expect(documentXml).toContain("second task");
  });

  it("mixes task items and plain items in one list", async () => {
    const buffer = await markdownToDocx("- [ ] task item\n- plain item");
    const documentXml = await readZipText(await openDocx(buffer), "word/document.xml");

    expect(documentXml).toContain("☐ ");
    expect(documentXml).toContain("task item");
    expect(documentXml).toContain("plain item");
    expect(documentXml).toContain("w:numPr");
  });

  it("keeps bullet numbering for plain list items", async () => {
    const buffer = await markdownToDocx("- plain item");
    const documentXml = await readZipText(await openDocx(buffer), "word/document.xml");

    expect(documentXml).toContain("w:numPr");
    expect(documentXml).not.toContain("☐");
  });
});

describe("raw html", () => {
  it("maps inline formatting tags to runs", async () => {
    const buffer = await markdownToDocx(
      'Text with <b>bold</b>, <i>italic</i>, <u>under</u>, <s>struck</s> and <a href="https://example.com">a link</a>.',
    );
    const zip = await openDocx(buffer);
    const documentXml = await readZipText(zip, "word/document.xml");

    expect(documentXml).toContain("bold");
    expect(documentXml).toContain("italic");
    expect(documentXml).toContain("under");
    expect(documentXml).toContain("struck");
    expect(documentXml).toContain("a link");
    expect(documentXml).toContain("<w:b/>");
    expect(documentXml).toContain("<w:i/>");
    expect(documentXml).toContain("<w:u ");
    expect(documentXml).toContain("<w:strike/>");
  });

  it("renders block level html", async () => {
    const buffer = await markdownToDocx(
      "<h2>HTML heading</h2>\n\n<p>HTML paragraph</p>\n\n<ul><li>first</li><li>second</li></ul>",
    );
    const documentXml = await readZipText(await openDocx(buffer), "word/document.xml");

    expect(documentXml).toContain("HTML heading");
    expect(documentXml).toContain("HTML paragraph");
    expect(documentXml).toContain("first");
    expect(documentXml).toContain("second");
  });

  it("applies html formatting inside table cells", async () => {
    const buffer = await markdownToDocx("| Col |\n| --- |\n| <b>cell bold</b> |");
    const documentXml = await readZipText(await openDocx(buffer), "word/document.xml");

    expect(documentXml).toContain("cell bold");
    expect(documentXml).toContain("<w:b/>");
  });

  it("renders html line breaks", async () => {
    const buffer = await markdownToDocx("first line<br>second line");
    const documentXml = await readZipText(await openDocx(buffer), "word/document.xml");

    expect(documentXml).toContain("<w:br/>");
    expect(documentXml).toContain("second line");
  });

  it("mixes markdown inside supported html tags", async () => {
    const buffer = await markdownToDocx("<u>underlined **and bold**</u>");
    const documentXml = await readZipText(await openDocx(buffer), "word/document.xml");

    expect(documentXml).toContain("<w:u ");
    expect(documentXml).toContain("<w:b/>");
    expect(documentXml).toContain("and bold");
  });

  it("renders html hyperlinks as real hyperlinks", async () => {
    const buffer = await markdownToDocx('<a href="https://example.com">click</a>');
    const zip = await openDocx(buffer);
    const documentXml = await readZipText(zip, "word/document.xml");
    const relsXml = await readZipText(zip, "word/_rels/document.xml.rels");

    expect(documentXml).toContain("click");
    expect(documentXml).toContain("w:hyperlink");
    expect(relsXml).toContain("https://example.com");
  });

  it("drops unsupported elements and their content", async () => {
    const buffer = await markdownToDocx("<script>alert(1)</script>\n\n<p>kept</p>");
    const documentXml = await readZipText(await openDocx(buffer), "word/document.xml");

    expect(documentXml).toContain("kept");
    expect(documentXml).not.toContain("alert(1)");
  });
});

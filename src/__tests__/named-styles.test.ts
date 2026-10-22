import { describe, expect, it } from "bun:test";
import JSZip from "jszip";
import { markdownToDocx } from "../platform/node.js";

const sample = [
  "# Title One",
  "",
  "## Title Two",
  "",
  "### Title Three",
  "",
  "#### Title Four",
  "",
  "Body with **bold**, `inline code`, and a [link](https://example.com).",
  "",
  "- bullet item",
  "- [ ] task item",
  "",
  "> quoted text",
  "",
  "```ts",
  "const total = 1;",
  "```",
  "",
  "| Head | Other |",
  "| --- | --- |",
  "| cell | more |",
].join("\n");

async function render(markdown: string, options?: Parameters<typeof markdownToDocx>[1]) {
  const zip = await JSZip.loadAsync(await markdownToDocx(markdown, options));
  const read = async (path: string) => {
    const file = zip.file(path);
    if (!file) throw new Error(`Missing zip entry: ${path}`);
    return file.async("text");
  };
  return { stylesXml: await read("word/styles.xml"), documentXml: await read("word/document.xml") };
}

function styleBlock(stylesXml: string, type: "paragraph" | "character", id: string): string {
  const match = stylesXml.match(
    new RegExp(`<w:style w:type="${type}"[^>]*w:styleId="${id}">[\\s\\S]*?</w:style>`),
  );
  if (!match) throw new Error(`Style ${id} not defined`);
  return match[0];
}

function paragraphsWithStyle(documentXml: string, id: string): string[] {
  return [...documentXml.matchAll(/<w:p>[\s\S]*?<\/w:p>/g)]
    .map((m) => m[0])
    .filter((p) => p.includes(`<w:pStyle w:val="${id}"/>`));
}

describe("named styles", () => {
  it("defines heading styles from the theme", async () => {
    const { stylesXml } = await render(sample, {
      theme: {
        fonts: { heading: "Georgia" },
        colors: { primary: "#112233", secondary: "#445566" },
        fontSize: { h1: 30, h3: 14 },
      },
    });

    const h1 = styleBlock(stylesXml, "paragraph", "Heading1");
    expect(h1).toContain('w:ascii="Georgia"');
    expect(h1).toContain('<w:color w:val="112233"/>');
    expect(h1).toContain('<w:sz w:val="60"/>');
    expect(h1).toContain("<w:b/>");
    expect(h1).toContain('w:before="360"');
    expect(h1).toContain('w:after="160"');
    expect(h1).toContain("<w:pBdr>");

    const h3 = styleBlock(stylesXml, "paragraph", "Heading3");
    expect(h3).toContain('<w:color w:val="445566"/>');
    expect(h3).toContain('<w:sz w:val="28"/>');
    expect(h3).not.toContain("<w:pBdr>");

    expect(stylesXml).toContain('w:styleId="Heading4"');
  });

  it("defines Normal with body font, color, and spacing", async () => {
    const { stylesXml } = await render(sample, {
      theme: { fonts: { body: "PT Serif" }, colors: { text: "#223344" } },
    });

    const normal = styleBlock(stylesXml, "paragraph", "Normal");
    expect(normal).toContain('w:ascii="PT Serif"');
    expect(normal).toContain('<w:color w:val="223344"/>');
    expect(normal).toContain('<w:sz w:val="22"/>');
    expect(normal).toContain('w:after="120"');
    expect(normal).toContain('w:line="286" w:lineRule="auto"');
  });

  it("defines Quote, SourceCode, CodeInline, Caption, table, and Hyperlink styles", async () => {
    const { stylesXml } = await render(sample, {
      theme: {
        fonts: { mono: "Fira Code" },
        colors: { primary: "#112233", codeBg: "#ABCDEF", quoteBg: "#FEDCBA", muted: "#777777" },
      },
    });

    const quote = styleBlock(stylesXml, "paragraph", "Quote");
    expect(quote).toContain('w:fill="FEDCBA"');
    expect(quote).toContain('w:color="112233"');
    expect(quote).toContain("<w:i/>");

    const code = styleBlock(stylesXml, "paragraph", "SourceCode");
    expect(code).toContain('w:fill="ABCDEF"');
    expect(code).toContain('w:ascii="Fira Code"');
    expect(code).toContain('<w:sz w:val="18"/>');

    const inline = styleBlock(stylesXml, "character", "CodeInline");
    expect(inline).toContain('w:fill="ABCDEF"');
    expect(inline).toContain('w:ascii="Fira Code"');

    const caption = styleBlock(stylesXml, "paragraph", "Caption");
    expect(caption).toContain('<w:color w:val="777777"/>');

    const header = styleBlock(stylesXml, "paragraph", "TableHeader");
    expect(header).toContain('<w:color w:val="FFFFFF"/>');
    expect(header).toContain("<w:b/>");
    expect(stylesXml).toContain('w:styleId="TableCell"');

    const link = styleBlock(stylesXml, "character", "Hyperlink");
    expect(link).toContain('<w:color w:val="112233"/>');
    expect(link).toContain('<w:u w:val="single"/>');
  });

  it("references styles from the body instead of direct formatting", async () => {
    const { documentXml } = await render(sample);

    for (const level of [1, 2, 3, 4]) {
      const [heading] = paragraphsWithStyle(documentXml, `Heading${level}`);
      expect(heading).toBeDefined();
      expect(heading).not.toContain("<w:rFonts");
      expect(heading).not.toContain("<w:color");
      expect(heading).not.toContain("<w:sz ");
      expect(heading).not.toContain("<w:pBdr>");
    }

    const [body] = paragraphsWithStyle(documentXml, "Normal");
    expect(body).toContain("Body with");
    expect(body).not.toContain("<w:rFonts");
    expect(body).not.toContain("<w:spacing");
    expect(body).toContain("<w:b/>");
    expect(body).toContain('<w:rStyle w:val="CodeInline"/>');
    expect(body).toContain('<w:rStyle w:val="Hyperlink"/>');
    expect(body).not.toContain("<w:shd");
    expect(body).not.toContain("<w:u ");

    const listItems = paragraphsWithStyle(documentXml, "ListParagraph");
    expect(listItems.some((p) => p.includes("bullet item"))).toBe(true);
    expect(listItems.some((p) => p.includes("task item"))).toBe(true);

    const [quote] = paragraphsWithStyle(documentXml, "Quote");
    expect(quote).toContain("quoted text");
    expect(quote).not.toContain("<w:shd");
    expect(quote).not.toContain("<w:i/>");

    const [code] = paragraphsWithStyle(documentXml, "SourceCode");
    expect(code).toContain("total");
    expect(code).not.toContain("<w:shd");
    expect(code).not.toContain("<w:rFonts");
    expect(code).toContain("<w:color");

    const [tableHeader] = paragraphsWithStyle(documentXml, "TableHeader");
    expect(tableHeader).toContain("Head");
    expect(tableHeader).not.toContain("<w:b/>");
    const [tableCell] = paragraphsWithStyle(documentXml, "TableCell");
    expect(tableCell).toContain("cell");
  });

  it("keeps the Normal style as the document default", async () => {
    const { stylesXml } = await render(sample);

    expect(stylesXml).toContain('<w:style w:type="paragraph" w:default="1" w:styleId="Normal">');
    expect(stylesXml.match(/w:styleId="Normal"/g)).toHaveLength(1);
    expect(stylesXml.match(/w:styleId="Heading1"/g)).toHaveLength(1);
  });
});

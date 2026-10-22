import { describe, expect, it } from "bun:test";
import JSZip from "jszip";
import { markdownToDocx } from "../platform/node.js";

async function render(markdown: string) {
  const zip = await JSZip.loadAsync(await markdownToDocx(markdown));
  const read = async (path: string) => {
    const file = zip.file(path);
    if (!file) throw new Error(`Missing zip entry: ${path}`);
    return file.async("text");
  };
  return {
    documentXml: await read("word/document.xml"),
    footnotesXml: await read("word/footnotes.xml"),
  };
}

describe("footnotes", () => {
  it("renders references and definitions as DOCX footnotes", async () => {
    const { documentXml, footnotesXml } = await render(
      "The window is two days.[^1]\n\n[^1]: Excluding bank holidays.",
    );

    expect(documentXml).toContain('<w:footnoteReference w:id="1"/>');
    expect(documentXml).toContain('<w:rStyle w:val="FootnoteReference"/>');
    expect(documentXml).not.toContain("[^1]");
    expect(documentXml).not.toContain("Excluding bank holidays");

    const footnote = footnotesXml.match(/<w:footnote w:id="1">[\s\S]*?<\/w:footnote>/)?.[0] ?? "";
    expect(footnote).toContain("Excluding bank holidays.");
    expect(footnote).toContain('<w:pStyle w:val="FootnoteText"/>');
  });

  it("numbers footnotes by order of first reference", async () => {
    const { documentXml, footnotesXml } = await render(
      "First[^b] then[^a] and again[^b].\n\n[^a]: Note A\n[^b]: Note B",
    );

    const ids = [...documentXml.matchAll(/<w:footnoteReference w:id="(\d+)"\/>/g)].map((m) => m[1]);
    expect(ids).toEqual(["1", "2", "1"]);
    expect(footnotesXml.match(/<w:footnote w:id="1">[\s\S]*?<\/w:footnote>/)?.[0]).toContain(
      "Note B",
    );
    expect(footnotesXml.match(/<w:footnote w:id="2">[\s\S]*?<\/w:footnote>/)?.[0]).toContain(
      "Note A",
    );
  });

  it("keeps the marker text when no definition exists", async () => {
    const { documentXml, footnotesXml } = await render("Dangling[^missing] reference.");

    expect(documentXml).toContain("[^missing]");
    expect(documentXml).not.toContain("<w:footnoteReference");
    expect(footnotesXml).not.toContain('<w:footnote w:id="1">');
  });

  it("renders formatting, links, and lists inside footnotes", async () => {
    const { footnotesXml } = await render(
      "Text[^n]\n\n[^n]: Has **bold** and [a link](https://example.com).\n\n    - nested item",
    );

    const footnote = footnotesXml.match(/<w:footnote w:id="1">[\s\S]*?<\/w:footnote>/)?.[0] ?? "";
    expect(footnote).toContain("<w:b/>");
    expect(footnote).toContain("<w:hyperlink");
    expect(footnote).toContain("nested item");
    expect(footnote).toContain('<w:pStyle w:val="ListParagraph"/>');
  });
});

import { describe, expect, it } from "bun:test";
import JSZip from "jszip";
import { markdownToDocx } from "../platform/node.js";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9l8AAAAASUVORK5CYII=",
  "base64",
);

async function render(markdown: string, options?: Parameters<typeof markdownToDocx>[1]) {
  const zip = await JSZip.loadAsync(await markdownToDocx(markdown, options));
  const documentXml = await zip.file("word/document.xml")?.async("text");
  if (!documentXml) throw new Error("Missing word/document.xml");
  return { zip, documentXml };
}

describe("math", () => {
  it("renders inline math as an OMML equation inside the paragraph", async () => {
    const { documentXml } = await render("Energy is $E = mc^2$ here.");

    const paragraph = documentXml.match(/<w:p>[\s\S]*?<\/w:p>/)?.[0] ?? "";
    expect(paragraph).toContain("Energy is ");
    expect(paragraph).toContain("<m:oMath");
    expect(paragraph).toContain("<m:sSup>");
    expect(paragraph).toContain(" here.");
    expect(paragraph).not.toContain("<m:oMathPara>");
    expect(documentXml).not.toContain("$E");
  });

  it("renders display math as a standalone equation paragraph", async () => {
    const { documentXml } = await render("Before\n\n$$\n\\frac{a}{b}\n$$\n\nAfter");

    expect(documentXml).toContain("<m:oMathPara>");
    expect(documentXml).toContain("<m:f>");
    expect(documentXml).toContain('<w:pStyle w:val="Normal"/>');
    expect(documentXml).not.toContain("\\frac");
  });

  it("keeps the source text when the LaTeX is invalid", async () => {
    const { documentXml } = await render("Broken $\\frac{$ math\n\n$$\n\\left(\n$$");

    expect(documentXml).not.toContain("<m:oMath");
    expect(documentXml).toContain("$\\frac{$");
    expect(documentXml).toContain("$$\\left($$");
  });
});

describe("codeBlockRenderers", () => {
  it("embeds the image returned for a matching fence language", async () => {
    const calls: Array<{ code: string; lang: string }> = [];
    const { documentXml, zip } = await render(
      ["```mermaid", "graph TD; A-->B", "```", "", "```ts", "const x = 1;", "```"].join("\n"),
      {
        codeBlockRenderers: {
          mermaid: async (input) => {
            calls.push(input);
            return { data: tinyPng, width: 320, height: 180 };
          },
        },
      },
    );

    expect(calls).toEqual([{ code: "graph TD; A-->B", lang: "mermaid" }]);
    expect(documentXml).not.toContain("graph TD");
    expect(documentXml).toContain("<w:drawing>");
    expect(documentXml).toContain('<w:jc w:val="center"/>');
    expect(documentXml).toContain('<w:pStyle w:val="SourceCode"/>');
    expect(documentXml).toContain(">const<");
    expect(Object.keys(zip.files).some((name) => name.startsWith("word/media/"))).toBe(true);
  });

  it("falls back to the code block when the renderer returns nothing", async () => {
    const { documentXml } = await render(["```mermaid", "graph TD; A-->B", "```"].join("\n"), {
      codeBlockRenderers: { mermaid: async () => null },
    });

    expect(documentXml).toContain("graph TD; A--&gt;B");
    expect(documentXml).toContain('<w:pStyle w:val="SourceCode"/>');
    expect(documentXml).not.toContain("<w:drawing>");
  });

  it("accepts raw bytes and measures the image", async () => {
    const { documentXml } = await render(["```plantuml", "@startuml", "```"].join("\n"), {
      codeBlockRenderers: { plantuml: async () => tinyPng },
    });

    expect(documentXml).toContain("<w:drawing>");
    expect(documentXml).not.toContain("@startuml");
  });

  it("renders diagrams inside list items", async () => {
    const { documentXml } = await render(
      ["- item", "", "  ```mermaid", "  graph TD; A-->B", "  ```"].join("\n"),
      { codeBlockRenderers: { mermaid: async () => tinyPng } },
    );

    expect(documentXml).toContain("<w:drawing>");
    expect(documentXml).not.toContain("graph TD");
  });
});

import { describe, expect, it } from "bun:test";
import JSZip from "jszip";
import { MarkdownToDocError } from "../errors/MarkdownToDocError.js";
import { markdownToDocx } from "../platform/node.js";
import { buildTemplate } from "./fixtures/template.js";

const markdown = ["# Heading", "", "Body text.", "", "> quote", "", "- item", "", "1. first"].join(
  "\n",
);

async function render(options: Parameters<typeof markdownToDocx>[1]) {
  const zip = await JSZip.loadAsync(await markdownToDocx(markdown, options));
  const read = async (path: string) => {
    const file = zip.file(path);
    if (!file) throw new Error(`Missing zip entry: ${path}`);
    return file.async("text");
  };
  return { zip, read };
}

function styleBlock(xml: string, id: string): string {
  const match = xml.match(
    new RegExp(`<w:style\\b[^>]*w:styleId="${id}"[^>]*>[\\s\\S]*?</w:style>`),
  );
  if (!match) throw new Error(`Style ${id} not defined`);
  return match[0];
}

describe("template", () => {
  it("inherits template styles and appends package styles the template lacks", async () => {
    const template = await buildTemplate();
    const { read } = await render({ template: { source: { kind: "buffer", value: template } } });
    const styles = await read("word/styles.xml");

    expect(styleBlock(styles, "Heading1")).toContain('w:ascii="Arial"');
    expect(styleBlock(styles, "Heading1")).toContain('<w:color w:val="FF0000"/>');
    expect(styleBlock(styles, "Normal")).toContain('w:ascii="Garamond"');
    expect(styles).toContain('w:styleId="AcmeBody"');
    expect(styleBlock(styles, "Quote")).toContain("<w:i/>");
    expect(styles).toContain('w:styleId="SourceCode"');
    expect(styles.match(/w:styleId="Normal"/g)).toHaveLength(1);
    expect(styles.match(/w:styleId="Heading1"/g)).toHaveLength(1);
    expect(styles).toContain('<w:style w:type="paragraph" w:default="1" w:styleId="Normal">');
  });

  it("lets explicit theme options override inherited styles", async () => {
    const template = await buildTemplate();
    const { read } = await render({
      template: { source: { kind: "buffer", value: template } },
      theme: { fonts: { heading: "Georgia" } },
    });
    const styles = await read("word/styles.xml");

    expect(styleBlock(styles, "Heading1")).toContain('w:ascii="Georgia"');
    expect(styleBlock(styles, "Heading1")).not.toContain('w:ascii="Arial"');
    expect(styles).toContain('w:styleId="AcmeBody"');
    expect(styles.match(/w:styleId="Heading1"/g)).toHaveLength(1);
  });

  it("merges template numbering without colliding with package lists", async () => {
    const template = await buildTemplate();
    const { read } = await render({
      template: { source: { kind: "buffer", value: template }, inherit: ["styles", "numbering"] },
    });
    const numbering = await read("word/numbering.xml");
    const styles = await read("word/styles.xml");
    const documentXml = await read("word/document.xml");

    expect(numbering).toContain('w:val="upperRoman"');
    const numIds = [...numbering.matchAll(/<w:num w:numId="(\d+)"/g)].map((m) => m[1]);
    expect(new Set(numIds).size).toBe(numIds.length);
    const abstractIds = [...numbering.matchAll(/<w:abstractNum w:abstractNumId="(\d+)"/g)].map(
      (m) => m[1],
    );
    expect(new Set(abstractIds).size).toBe(abstractIds.length);
    expect(numbering.lastIndexOf("<w:abstractNum ")).toBeLessThan(numbering.indexOf("<w:num "));

    const acmeNumId = styleBlock(styles, "AcmeBody").match(/<w:numId w:val="(\d+)"\/>/)?.[1];
    expect(acmeNumId).toBeDefined();
    expect(numbering).toContain(`<w:num w:numId="${acmeNumId}">`);
    for (const [, id] of documentXml.matchAll(/<w:numId w:val="(\d+)"\/>/g)) {
      expect(numbering).toContain(`<w:num w:numId="${id}">`);
    }
  });

  it("drops numbering references from inherited styles when numbering is not inherited", async () => {
    const template = await buildTemplate();
    const { read } = await render({ template: { source: { kind: "buffer", value: template } } });
    const styles = await read("word/styles.xml");

    expect(styleBlock(styles, "AcmeBody")).not.toContain("<w:numPr>");
  });

  it("copies the theme part and wires it into the package", async () => {
    const template = await buildTemplate();
    const { read } = await render({
      template: { source: { kind: "buffer", value: template }, inherit: ["theme"] },
    });

    expect(await read("word/theme/theme1.xml")).toContain('name="Acme"');
    expect(await read("[Content_Types].xml")).toContain('PartName="/word/theme/theme1.xml"');
    expect(await read("word/_rels/document.xml.rels")).toContain('Target="theme/theme1.xml"');
  });

  it("copies selected settings in schema order", async () => {
    const template = await buildTemplate();
    const { read } = await render({
      template: { source: { kind: "buffer", value: template }, inherit: ["settings"] },
    });
    const settings = await read("word/settings.xml");

    expect(settings).toContain('<w:defaultTabStop w:val="720"/>');
    expect(settings).toContain('<w:themeFontLang w:val="en-GB"/>');
    expect(settings.match(/<w:compat>/g)).toHaveLength(1);
    expect(settings.indexOf("<w:defaultTabStop")).toBeLessThan(
      settings.indexOf("<w:evenAndOddHeaders"),
    );
    expect(settings.indexOf("<w:evenAndOddHeaders")).toBeLessThan(settings.indexOf("<w:compat>"));
    expect(settings.indexOf("<w:compat>")).toBeLessThan(settings.indexOf("<w:themeFontLang"));
  });

  it("reuses template headers, footers, and section properties", async () => {
    const template = await buildTemplate();
    const { zip, read } = await render({
      template: { source: { kind: "buffer", value: template }, headers: "template" },
      header: { show: true, left: { type: "text", value: "Package header" } },
    });
    const documentXml = await read("word/document.xml");
    const rels = await read("word/_rels/document.xml.rels");
    const contentTypes = await read("[Content_Types].xml");

    const sectPr = documentXml.match(/<w:sectPr>[\s\S]*<\/w:sectPr>/)?.[0] ?? "";
    expect(sectPr).toContain('<w:pgSz w:w="12240" w:h="15840"');
    expect(sectPr).toContain('w:left="2000"');
    expect(sectPr).toContain("<w:titlePg/>");

    const refs = [...sectPr.matchAll(/<w:headerReference w:type="(\w+)" r:id="(\w+)"\/>/g)];
    expect(refs.map((m) => m[1]).sort()).toEqual(["default", "first"]);

    const parts: string[] = [];
    for (const [, , rId] of refs) {
      const target = rels.match(new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`))?.[1];
      expect(target).toBeDefined();
      expect(contentTypes).toContain(`PartName="/word/${target}"`);
      parts.push(await read(`word/${target}`));
    }
    const joined = parts.join("\n");
    expect(joined).toContain("ACME CONFIDENTIAL");
    expect(joined).toContain("ACME FIRST PAGE");

    const headerWithImage = parts.find((p) => p.includes("ACME CONFIDENTIAL")) ?? "";
    const embed = headerWithImage.match(/r:embed="(\w+)"/)?.[1];
    expect(embed).toBeDefined();
    const headerRelsEntries = Object.keys(zip.files).filter((n) =>
      /word\/_rels\/.*header.*\.rels$/.test(n),
    );
    const headerRels = (await Promise.all(headerRelsEntries.map((n) => read(n)))).join("\n");
    const mediaTarget = headerRels.match(new RegExp(`Id="${embed}"[^>]*Target="([^"]+)"`))?.[1];
    expect(mediaTarget).toBeDefined();
    expect(zip.file(`word/${mediaTarget}`)).not.toBeNull();

    expect(joined).not.toContain("Package header");
    expect(documentXml).not.toContain("Package header");
  });

  it("throws a clear error for invalid files and missing parts", async () => {
    await expect(
      markdownToDocx(markdown, {
        template: { source: { kind: "buffer", value: Buffer.from("not a docx") } },
      }),
    ).rejects.toThrow(MarkdownToDocError);
    await expect(
      markdownToDocx(markdown, {
        template: { source: { kind: "buffer", value: Buffer.from("not a docx") } },
      }),
    ).rejects.toThrow(/valid DOCX/);

    const noNumbering = await buildTemplate({ numbering: false });
    await expect(
      markdownToDocx(markdown, {
        template: { source: { kind: "buffer", value: noNumbering }, inherit: ["numbering"] },
      }),
    ).rejects.toThrow(/numbering/);
  });
});

import {
  AlignmentType,
  Document,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import JSZip from "jszip";

export const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9l8AAAAASUVORK5CYII=",
  "base64",
);

const THEME_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Acme"><a:themeElements/></a:theme>';

/**
 * Builds a corporate-style template DOCX with custom styles, numbering,
 * a first-page header carrying an image, a theme part, and settings.
 */
export async function buildTemplate(options: { numbering?: boolean } = {}): Promise<Buffer> {
  const document = new Document({
    styles: {
      default: {
        document: { run: { font: "Garamond", size: 24 } },
        heading1: { run: { font: "Arial", color: "FF0000", size: 40, bold: true } },
      },
      paragraphStyles: [
        { id: "Normal", name: "Normal", run: { font: "Garamond", size: 24 } },
        {
          id: "AcmeBody",
          name: "Acme Body",
          basedOn: "Normal",
          run: { italics: true },
        },
      ],
    },
    numbering:
      options.numbering === false
        ? undefined
        : {
            config: [
              {
                reference: "acme-list",
                levels: [{ level: 0, format: LevelFormat.UPPER_ROMAN, text: "%1." }],
              },
            ],
          },
    sections: [
      {
        properties: {
          titlePage: true,
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 2000, bottom: 2000, left: 2000, right: 2000 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun("ACME CONFIDENTIAL"),
                  new ImageRun({
                    type: "png",
                    data: tinyPng,
                    transformation: { width: 10, height: 10 },
                  }),
                ],
              }),
            ],
          }),
          first: new Header({ children: [new Paragraph("ACME FIRST PAGE")] }),
        },
        children: [
          new Paragraph({ text: "Template heading", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: "Template body", style: "AcmeBody" }),
        ],
      },
    ],
  });

  const zip = await JSZip.loadAsync(await Packer.toBuffer(document));
  zip.file("word/theme/theme1.xml", THEME_XML);

  const settings = await zip.file("word/settings.xml")?.async("text");
  if (settings) {
    zip.file(
      "word/settings.xml",
      settings
        .replace(
          "<w:evenAndOddHeaders",
          '<w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:evenAndOddHeaders',
        )
        .replace("</w:settings>", '<w:themeFontLang w:val="en-GB"/></w:settings>'),
    );
  }

  if (options.numbering === false) {
    zip.remove("word/numbering.xml");
  } else {
    const numbering = (await zip.file("word/numbering.xml")?.async("text")) ?? "";
    const numId = Math.max(
      ...[...numbering.matchAll(/<w:num w:numId="(\d+)"/g)].map((m) => Number(m[1])),
    );
    const styles = (await zip.file("word/styles.xml")?.async("text")) ?? "";
    zip.file(
      "word/styles.xml",
      styles.replace(
        '<w:name w:val="Acme Body"/><w:basedOn w:val="Normal"/>',
        `<w:name w:val="Acme Body"/><w:basedOn w:val="Normal"/><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>`,
      ),
    );
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

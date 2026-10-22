import JSZip from "jszip";
import { MarkdownToDocError } from "../errors/MarkdownToDocError.js";
import type { TemplateInheritPart } from "../types/markdown-to-doc.types.js";

const PART_PATHS: Record<TemplateInheritPart, string> = {
  styles: "word/styles.xml",
  numbering: "word/numbering.xml",
  theme: "word/theme/theme1.xml",
  settings: "word/settings.xml",
};

const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CONTENT_TYPES: Record<"header" | "footer", string> = {
  header: "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml",
  footer: "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml",
};

export interface LoadedTemplate {
  zip: JSZip;
  /** Page width minus left and right margins from the template section, in twips. */
  contentWidthTwips?: number;
}

export interface ApplyTemplateOptions {
  inherit: TemplateInheritPart[];
  headers: "template" | "document";
  /** When true, package styles override template styles of the same id. */
  themeOverrides: boolean;
  coverShowHeader: boolean;
  coverShowFooter: boolean;
}

/**
 * Opens a template DOCX and validates that it is a Word package.
 */
export async function loadTemplate(
  bytes: Uint8Array,
  readSection: boolean,
): Promise<LoadedTemplate> {
  let zip: JSZip;

  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new MarkdownToDocError("The template is not a valid DOCX file.");
  }

  const documentXml = await zip.file("word/document.xml")?.async("string");

  if (!documentXml) {
    throw new MarkdownToDocError(
      "The template is not a valid DOCX file: word/document.xml is missing.",
    );
  }

  if (!readSection) {
    return { zip };
  }

  const sectPr = lastSectionProperties(documentXml);
  const width = Number(sectPr?.match(/<w:pgSz\b[^>]*w:w="(\d+)"/)?.[1]);
  const left = Number(sectPr?.match(/<w:pgMar\b[^>]*w:left="(\d+)"/)?.[1]);
  const right = Number(sectPr?.match(/<w:pgMar\b[^>]*w:right="(\d+)"/)?.[1]);

  return {
    zip,
    contentWidthTwips: width && !Number.isNaN(left + right) ? width - left - right : undefined,
  };
}

/**
 * Copies the requested template parts into the generated package.
 */
export async function applyTemplate(
  zip: JSZip,
  template: LoadedTemplate,
  options: ApplyTemplateOptions,
): Promise<void> {
  const parts: Partial<Record<TemplateInheritPart, string>> = {};

  for (const part of options.inherit) {
    const content = await template.zip.file(PART_PATHS[part])?.async("string");

    if (!content) {
      throw new MarkdownToDocError(
        `The template is missing the requested ${part} part (${PART_PATHS[part]}).`,
      );
    }

    parts[part] = content;
  }

  let numIdOffset = 0;

  if (parts.numbering) {
    numIdOffset = await mergeNumbering(zip, parts.numbering);
  }

  if (parts.styles) {
    await mergeStyles(
      zip,
      parts.styles,
      options.themeOverrides,
      parts.numbering ? numIdOffset : null,
    );
  }

  if (parts.theme) {
    await addThemePart(zip, parts.theme);
  }

  if (parts.settings) {
    await mergeSettings(zip, parts.settings);
  }

  if (options.headers === "template") {
    await copySectionProperties(zip, template.zip, options, numIdOffset);
  }
}

function lastSectionProperties(documentXml: string): string | undefined {
  const matches = documentXml.match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g);

  return matches?.[matches.length - 1];
}

function styleBlocks(xml: string): Map<string, string> {
  const blocks = new Map<string, string>();

  for (const match of xml.matchAll(/<w:style\b[^>]*>[\s\S]*?<\/w:style>/g)) {
    const id = match[0].match(/^<w:style\b[^>]*w:styleId="([^"]+)"/)?.[1];

    if (id) {
      blocks.set(id, match[0]);
    }
  }

  return blocks;
}

async function mergeStyles(
  zip: JSZip,
  templateStyles: string,
  themeOverrides: boolean,
  numIdOffset: number | null,
): Promise<void> {
  const ownStyles = (await zip.file("word/styles.xml")?.async("string")) ?? "";
  const own = styleBlocks(ownStyles);
  let merged =
    numIdOffset === null
      ? templateStyles.replace(/<w:numPr>[\s\S]*?<\/w:numPr>/g, "")
      : shiftNumIds(templateStyles, numIdOffset);
  const existing = styleBlocks(merged);
  const additions: string[] = [];

  for (const [id, block] of own) {
    const current = existing.get(id);

    if (!current) {
      additions.push(block);
      continue;
    }

    if (themeOverrides) {
      merged = merged.replace(current, block);
    }
  }

  merged = merged.replace("</w:styles>", `${additions.join("")}</w:styles>`);

  if (!/<w:style w:type="paragraph" w:default="1"/.test(merged)) {
    merged = merged.replace(
      /<w:style w:type="paragraph"([^>]*w:styleId="Normal")/,
      '<w:style w:type="paragraph" w:default="1"$1',
    );
  }

  if (!/<w:style w:type="character" w:default="1"/.test(merged)) {
    merged = merged.replace(
      /<w:style w:type="character"([^>]*w:styleId="DefaultParagraphFont")/,
      '<w:style w:type="character" w:default="1"$1',
    );
  }

  zip.file("word/styles.xml", merged);
}

function shiftNumIds(xml: string, offset: number): string {
  return xml.replace(
    /<w:numId w:val="(\d+)"\/>/g,
    (_, id) => `<w:numId w:val="${Number(id) + offset}"/>`,
  );
}

async function mergeNumbering(zip: JSZip, templateNumbering: string): Promise<number> {
  const own = (await zip.file("word/numbering.xml")?.async("string")) ?? "";
  const maxId = (xml: string, pattern: RegExp) =>
    Math.max(0, ...[...xml.matchAll(pattern)].map((match) => Number(match[1])));
  const abstractOffset = maxId(own, /<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"/g);
  const numOffset = maxId(own, /<w:num\b[^>]*w:numId="(\d+)"/g);

  const abstractNums = (
    templateNumbering.match(/<w:abstractNum\b[^>]*>[\s\S]*?<\/w:abstractNum>/g) ?? []
  )
    .map((block) =>
      block.replace(
        /(<w:abstractNum\b[^>]*w:abstractNumId=")(\d+)(")/,
        (_, before, id, after) => `${before}${Number(id) + abstractOffset}${after}`,
      ),
    )
    .join("");
  const nums = (templateNumbering.match(/<w:num\b[^>]*>[\s\S]*?<\/w:num>/g) ?? [])
    .map((block) =>
      block
        .replace(
          /(<w:num\b[^>]*w:numId=")(\d+)(")/,
          (_, before, id, after) => `${before}${Number(id) + numOffset}${after}`,
        )
        .replace(
          /<w:abstractNumId w:val="(\d+)"\/>/,
          (_, id) => `<w:abstractNumId w:val="${Number(id) + abstractOffset}"/>`,
        ),
    )
    .join("");

  const firstNum = own.search(/<w:num\b/);
  const merged =
    firstNum === -1
      ? own.replace("</w:numbering>", `${abstractNums}${nums}</w:numbering>`)
      : `${own.slice(0, firstNum)}${abstractNums}${own.slice(firstNum)}`.replace(
          "</w:numbering>",
          `${nums}</w:numbering>`,
        );

  zip.file("word/numbering.xml", merged);

  return numOffset;
}

async function addThemePart(zip: JSZip, theme: string): Promise<void> {
  zip.file("word/theme/theme1.xml", theme);
  await addContentTypeOverride(
    zip,
    "/word/theme/theme1.xml",
    "application/vnd.openxmlformats-officedocument.theme+xml",
  );
  await addRelationship(zip, "word/_rels/document.xml.rels", `${REL_NS}/theme`, "theme/theme1.xml");
}

const SETTINGS_BEFORE_HEADERS = ["defaultTabStop", "characterSpacingControl"];
const SETTINGS_AFTER_HEADERS = [
  "compat",
  "themeFontLang",
  "clrSchemeMapping",
  "decimalSymbol",
  "listSeparator",
];

async function mergeSettings(zip: JSZip, templateSettings: string): Promise<void> {
  const own = (await zip.file("word/settings.xml")?.async("string")) ?? "";
  const pick = (names: string[]) =>
    names
      .map(
        (name) =>
          templateSettings.match(
            new RegExp(`<w:${name}\\b(?:[^>]*/>|[^>]*>[\\s\\S]*?</w:${name}>)`),
          )?.[0],
      )
      .filter((value): value is string => Boolean(value));
  const before = pick(SETTINGS_BEFORE_HEADERS).join("");
  const after = pick(SETTINGS_AFTER_HEADERS);
  let merged = own;

  if (after.some((entry) => entry.startsWith("<w:compat"))) {
    merged = merged.replace(/<w:compat\b(?:[^>]*\/>|[^>]*>[\s\S]*?<\/w:compat>)/, "");
  }

  merged = merged.includes("<w:evenAndOddHeaders")
    ? merged.replace("<w:evenAndOddHeaders", `${before}<w:evenAndOddHeaders`)
    : merged.replace("</w:settings>", `${before}</w:settings>`);

  zip.file("word/settings.xml", merged.replace("</w:settings>", `${after.join("")}</w:settings>`));
}

async function copySectionProperties(
  zip: JSZip,
  templateZip: JSZip,
  options: ApplyTemplateOptions,
  numIdOffset: number,
): Promise<void> {
  const templateDocument = (await templateZip.file("word/document.xml")?.async("string")) ?? "";
  const sectPr = lastSectionProperties(templateDocument);

  if (!sectPr) {
    throw new MarkdownToDocError("The template document has no section properties to reuse.");
  }

  const templateRels = parseRelationships(
    (await templateZip.file("word/_rels/document.xml.rels")?.async("string")) ?? "",
  );
  let section = sectPr.replace(/^<w:sectPr\b[^>]*>/, "<w:sectPr>");
  let counter = 0;

  for (const match of sectPr.matchAll(/<w:(header|footer)Reference\b[^>]*\/>/g)) {
    const tag = match[0];
    const kind = match[1] as "header" | "footer";
    const rId = tag.match(/r:id="([^"]+)"/)?.[1];
    const target = rId ? templateRels.get(rId) : undefined;

    if (!target) {
      section = section.replace(tag, "");
      continue;
    }

    const newName = await copyPart(zip, templateZip, target, numIdOffset);
    const newId = `rIdTemplate${++counter}`;
    await addContentTypeOverride(zip, `/word/${newName}`, CONTENT_TYPES[kind]);
    await addRelationship(zip, "word/_rels/document.xml.rels", `${REL_NS}/${kind}`, newName, newId);
    section = section.replace(tag, tag.replace(/r:id="[^"]+"/, `r:id="${newId}"`));
  }

  const documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  const occurrences = documentXml.match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g) ?? [];
  let patched = documentXml;

  occurrences.forEach((occurrence, index) => {
    const isLast = index === occurrences.length - 1;
    let replacement = section;

    if (!isLast && !options.coverShowHeader) {
      replacement = replacement.replace(/<w:headerReference\b[^>]*\/>/g, "");
    }

    if (!isLast && !options.coverShowFooter) {
      replacement = replacement.replace(/<w:footerReference\b[^>]*\/>/g, "");
    }

    patched = patched.replace(occurrence, replacement);
  });

  zip.file("word/document.xml", patched);
}

/**
 * Copies a part under `word/` from the template, along with its relationships
 * and any media they reference. Returns the new target relative to `word/`.
 */
async function copyPart(
  zip: JSZip,
  templateZip: JSZip,
  target: string,
  numIdOffset: number,
): Promise<string> {
  const newTarget = prefixFileName(target);
  const content = await templateZip.file(`word/${target}`)?.async("uint8array");

  if (!content) {
    throw new MarkdownToDocError(`The template is missing the part word/${target}.`);
  }

  const relsPath = `word/_rels/${target}.rels`;
  const rels = await templateZip.file(relsPath)?.async("string");
  let xml = new TextDecoder().decode(content);

  if (numIdOffset > 0) {
    xml = shiftNumIds(xml, numIdOffset);
  }

  zip.file(`word/${newTarget}`, xml);

  if (!rels) {
    return newTarget;
  }

  let copiedRels = rels;

  for (const match of rels.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const tag = match[0];
    const relTarget = tag.match(/Target="([^"]+)"/)?.[1];

    if (!relTarget || /TargetMode="External"/.test(tag)) {
      continue;
    }

    const resolved = resolveTarget(target, relTarget);
    const data = await templateZip.file(`word/${resolved}`)?.async("uint8array");

    if (!data) {
      copiedRels = copiedRels.replace(tag, "");
      continue;
    }

    const copied = prefixFileName(resolved);
    zip.file(`word/${copied}`, data);
    await ensureDefaultContentType(zip, templateZip, copied);
    copiedRels = copiedRels.replace(
      tag,
      tag.replace(`Target="${relTarget}"`, `Target="${copied}"`),
    );
  }

  zip.file(`word/_rels/${newTarget}.rels`, copiedRels);

  return newTarget;
}

function prefixFileName(target: string): string {
  const slash = target.lastIndexOf("/");

  return `${target.slice(0, slash + 1)}template-${target.slice(slash + 1)}`;
}

function resolveTarget(fromPart: string, target: string): string {
  if (target.startsWith("/")) {
    return target.replace(/^\/word\//, "");
  }

  const base = fromPart.includes("/") ? fromPart.slice(0, fromPart.lastIndexOf("/") + 1) : "";
  const segments: string[] = [];

  for (const segment of `${base}${target}`.split("/")) {
    if (segment === "..") {
      segments.pop();
    } else if (segment && segment !== ".") {
      segments.push(segment);
    }
  }

  return segments.join("/");
}

function parseRelationships(xml: string): Map<string, string> {
  const map = new Map<string, string>();

  for (const match of xml.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const id = match[0].match(/\bId="([^"]+)"/)?.[1];
    const target = match[0].match(/Target="([^"]+)"/)?.[1];

    if (id && target && !/TargetMode="External"/.test(match[0])) {
      map.set(id, target.replace(/^\/word\//, ""));
    }
  }

  return map;
}

async function addContentTypeOverride(zip: JSZip, partName: string, contentType: string) {
  const xml = (await zip.file("[Content_Types].xml")?.async("string")) ?? "";

  if (xml.includes(`PartName="${partName}"`)) {
    return;
  }

  zip.file(
    "[Content_Types].xml",
    xml.replace(
      "</Types>",
      `<Override ContentType="${contentType}" PartName="${partName}"/></Types>`,
    ),
  );
}

async function ensureDefaultContentType(zip: JSZip, templateZip: JSZip, fileName: string) {
  const extension = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
  const xml = (await zip.file("[Content_Types].xml")?.async("string")) ?? "";

  if (!extension || new RegExp(`Extension="${extension}"`, "i").test(xml)) {
    return;
  }

  const templateTypes = (await templateZip.file("[Content_Types].xml")?.async("string")) ?? "";
  const entry = templateTypes.match(
    new RegExp(`<Default\\b[^>]*Extension="${extension}"[^>]*/>`, "i"),
  )?.[0];

  if (entry) {
    zip.file(
      "[Content_Types].xml",
      xml.replace("<Types", `<Types`).replace(/(<Types\b[^>]*>)/, `$1${entry}`),
    );
  }
}

async function addRelationship(
  zip: JSZip,
  relsPath: string,
  type: string,
  target: string,
  id?: string,
): Promise<void> {
  const xml = (await zip.file(relsPath)?.async("string")) ?? "";

  if (xml.includes(`Target="${target}"`)) {
    return;
  }

  const nextId =
    id ??
    `rId${Math.max(0, ...[...xml.matchAll(/\bId="rId(\d+)"/g)].map((m) => Number(m[1]))) + 1}`;

  zip.file(
    relsPath,
    xml.replace(
      "</Relationships>",
      `<Relationship Id="${nextId}" Type="${type}" Target="${target}"/></Relationships>`,
    ),
  );
}

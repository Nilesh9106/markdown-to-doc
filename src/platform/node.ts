import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderDocx, toDocxBlob } from "../markdown-to-doc.js";
import type { MarkdownToDocxOptions, Platform } from "../types/markdown-to-doc.types.js";

const nodePlatform: Platform = {
  readLocalFile: (baseDir, src) => readFile(path.resolve(baseDir, src)),
  defaultBaseDir: () => process.cwd(),
};

/**
 * Converts markdown into a styled DOCX file and returns the resulting buffer.
 *
 * @param markdown Markdown source to render.
 * @param options Optional document configuration. All fields have defaults.
 * @returns A `Buffer` containing the generated `.docx` file.
 */
export async function markdownToDocx(
  markdown: string,
  options: MarkdownToDocxOptions = {},
): Promise<Buffer> {
  const bytes = await renderDocx(markdown, options, nodePlatform);

  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Converts markdown into a styled DOCX file and returns it as a `Blob`.
 */
export async function markdownToDocxBlob(
  markdown: string,
  options: MarkdownToDocxOptions = {},
): Promise<Blob> {
  return toDocxBlob(await renderDocx(markdown, options, nodePlatform));
}

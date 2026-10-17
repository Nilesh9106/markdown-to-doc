import { MarkdownToDocError } from "../errors/MarkdownToDocError.js";
import { renderDocx, toDocxBlob } from "../markdown-to-doc.js";
import type { MarkdownToDocxOptions, Platform } from "../types/markdown-to-doc.types.js";

const browserPlatform: Platform = {
  readLocalFile: async () => {
    throw new MarkdownToDocError(
      "Local image paths are not supported in the browser. Use a URL, a data URL, or assets.resolveImage.",
    );
  },
  defaultBaseDir: () => "",
};

/**
 * Converts markdown into a styled DOCX file and returns the resulting bytes.
 *
 * @param markdown Markdown source to render.
 * @param options Optional document configuration. All fields have defaults.
 * @returns A `Uint8Array` containing the generated `.docx` file.
 */
export function markdownToDocx(
  markdown: string,
  options: MarkdownToDocxOptions = {},
): Promise<Uint8Array> {
  return renderDocx(markdown, options, browserPlatform);
}

/**
 * Converts markdown into a styled DOCX file and returns it as a `Blob`.
 */
export async function markdownToDocxBlob(
  markdown: string,
  options: MarkdownToDocxOptions = {},
): Promise<Blob> {
  return toDocxBlob(await renderDocx(markdown, options, browserPlatform));
}

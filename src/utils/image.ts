import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { imageSize } from "image-size";
import { MarkdownToDocError } from "../errors/MarkdownToDocError.js";
import type { AssetOptions, ImageSource, ResolvedImage } from "../types/markdown-to-doc.types.js";

const DATA_URL_PATTERN = /^data:(?<mime>image\/[a-zA-Z0-9.+-]+);base64,(?<data>.+)$/;
const REMOTE_URL_PATTERN = /^https?:\/\//i;

export interface SizedImage {
  data: Buffer;
  width: number;
  height: number;
  type: "jpg" | "png" | "gif" | "bmp";
}

/**
 * Resolves a configured image source into binary data.
 */
export async function resolveConfiguredImage(
  source: ImageSource,
  baseDir: string,
): Promise<SizedImage> {
  if (source.kind === "buffer") {
    return withMeasuredSize({ data: source.value });
  }

  if (source.kind === "base64") {
    return withMeasuredSize({ data: Buffer.from(source.value, "base64") });
  }

  return withMeasuredSize({
    data: await readFile(path.resolve(baseDir, source.value)),
  });
}

/**
 * Resolves a markdown image source using the user callback first and the
 * built-in resolver second.
 */
export async function resolveMarkdownImage(
  input: { src: string; alt?: string; title?: string },
  assets: Required<AssetOptions>,
): Promise<SizedImage> {
  const resolvedByUser = await assets.resolveImage(input);

  if (Buffer.isBuffer(resolvedByUser)) {
    return withMeasuredSize({ data: resolvedByUser });
  }

  if (resolvedByUser) {
    return withMeasuredSize(resolvedByUser);
  }

  if (DATA_URL_PATTERN.test(input.src)) {
    const match = input.src.match(DATA_URL_PATTERN);

    if (!match?.groups?.data) {
      throw new MarkdownToDocError(`Invalid data URL image source: ${input.src}`);
    }

    return withMeasuredSize({
      data: Buffer.from(match.groups.data, "base64"),
    });
  }

  if (REMOTE_URL_PATTERN.test(input.src)) {
    if (!assets.fetchRemoteImages) {
      throw new MarkdownToDocError(`Remote image fetching is disabled for source: ${input.src}`);
    }

    const response = await fetch(input.src);

    if (!response.ok) {
      throw new MarkdownToDocError(`Failed to fetch markdown image: ${input.src}`, {
        status: response.status,
      });
    }

    const arrayBuffer = await response.arrayBuffer();

    return withMeasuredSize({
      data: Buffer.from(arrayBuffer),
    });
  }

  return withMeasuredSize({
    data: await readFile(path.resolve(assets.baseDir, input.src)),
  });
}

function withMeasuredSize(image: ResolvedImage): SizedImage {
  const size = imageSize(image.data);

  if (!size.width || !size.height || !size.type) {
    throw new MarkdownToDocError("Unable to determine image dimensions.");
  }

  if (!["jpg", "png", "gif", "bmp"].includes(size.type)) {
    throw new MarkdownToDocError(`Unsupported image type: ${size.type}`);
  }

  return {
    data: image.data,
    width: image.width ?? size.width,
    height: image.height ?? size.height,
    type: size.type as SizedImage["type"],
  };
}

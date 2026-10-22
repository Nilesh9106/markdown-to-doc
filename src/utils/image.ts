import { imageSize } from "image-size";
import { MarkdownToDocError } from "../errors/MarkdownToDocError.js";
import type { AssetOptions, ImageSource, ResolvedImage } from "../types/markdown-to-doc.types.js";
import { base64ToBytes, isBinaryData, toBytes } from "./bytes.js";

const DATA_URL_PATTERN = /^data:(?<mime>image\/[a-zA-Z0-9.+-]+);base64,(?<data>.+)$/;
const REMOTE_URL_PATTERN = /^https?:\/\//i;
const TRANSPARENT_PNG_FALLBACK = base64ToBytes(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9l8AAAAASUVORK5CYII=",
);

type SupportedImageType = "jpg" | "png" | "gif" | "bmp" | "svg";

/**
 * Reads a local image path relative to the configured base directory.
 */
export type LocalImageReader = (src: string) => Promise<Uint8Array>;

interface MeasurableImage {
  data: Uint8Array;
  width?: number;
  height?: number;
}

export interface SizedImage {
  data: Uint8Array;
  width: number;
  height: number;
  type: SupportedImageType;
  fallback?: {
    data: Uint8Array;
    type: "png";
  };
}

/**
 * Resolves a configured image source into binary data.
 */
export async function resolveConfiguredImage(
  source: ImageSource,
  readLocalImage: LocalImageReader,
): Promise<SizedImage> {
  if (source.kind === "buffer") {
    return withMeasuredSize({ data: toBytes(source.value) });
  }

  if (source.kind === "base64") {
    return withMeasuredSize({ data: base64ToBytes(source.value) });
  }

  return withMeasuredSize({
    data: await readLocalImage(source.value),
  });
}

export async function tryResolveConfiguredImage(
  source: ImageSource,
  readLocalImage: LocalImageReader,
): Promise<SizedImage | null> {
  try {
    return await resolveConfiguredImage(source, readLocalImage);
  } catch {
    return null;
  }
}

/**
 * Resolves a markdown image source using the user callback first and the
 * built-in resolver second.
 */
export async function resolveMarkdownImage(
  input: { src: string; alt?: string; title?: string },
  assets: Required<AssetOptions>,
  readLocalImage: LocalImageReader,
): Promise<SizedImage> {
  const resolvedByUser = await assets.resolveImage(input);

  if (resolvedByUser) {
    return resolveCallbackImage(resolvedByUser);
  }

  if (DATA_URL_PATTERN.test(input.src)) {
    const match = input.src.match(DATA_URL_PATTERN);

    if (!match?.groups?.data) {
      throw new MarkdownToDocError(`Invalid data URL image source: ${input.src}`);
    }

    return withMeasuredSize({
      data: base64ToBytes(match.groups.data),
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
      data: new Uint8Array(arrayBuffer),
    });
  }

  return withMeasuredSize({
    data: await readLocalImage(input.src),
  });
}

export async function tryResolveMarkdownImage(
  input: { src: string; alt?: string; title?: string },
  assets: Required<AssetOptions>,
  readLocalImage: LocalImageReader,
): Promise<SizedImage | null> {
  try {
    return await resolveMarkdownImage(input, assets, readLocalImage);
  } catch {
    return null;
  }
}

/**
 * Normalizes an image returned from a user callback into a sized image.
 */
export function resolveCallbackImage(result: ResolvedImage | Uint8Array | ArrayBuffer): SizedImage {
  if (isBinaryData(result)) {
    return withMeasuredSize({ data: toBytes(result) });
  }

  return withMeasuredSize({ ...result, data: toBytes(result.data) });
}

function withMeasuredSize(image: MeasurableImage): SizedImage {
  const size = imageSize(image.data);

  if (!size.width || !size.height || !size.type) {
    throw new MarkdownToDocError("Unable to determine image dimensions.");
  }

  if (size.type === "svg") {
    return {
      data: image.data,
      width: image.width ?? size.width,
      height: image.height ?? size.height,
      type: size.type,
      fallback: {
        data: TRANSPARENT_PNG_FALLBACK,
        type: "png",
      },
    };
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

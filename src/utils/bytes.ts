export type BinaryData = Uint8Array | ArrayBuffer;

export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function isBinaryData(value: unknown): value is BinaryData {
  return value instanceof Uint8Array || value instanceof ArrayBuffer;
}

export function toBytes(value: BinaryData): Uint8Array {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

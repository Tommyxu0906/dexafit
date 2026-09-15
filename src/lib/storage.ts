import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_BYTES } from "./domain/enums";

export type SniffedType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

const EXTENSIONS: Record<SniffedType, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((b, i) => bytes[offset + i] === b);
}

/**
 * Determine the real content type from the file's magic bytes.
 *
 * The browser-supplied `file.type` and the filename extension are both attacker
 * controlled, so neither is trusted; a mismatch is rejected rather than coerced.
 */
export function sniffMimeType(bytes: Uint8Array): SniffedType | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  )
    return "image/webp";
  return null;
}

export type UploadValidation =
  | { ok: true; mimeType: SniffedType; extension: string }
  | { ok: false; error: string };

export function validateUpload(bytes: Uint8Array, size: number): UploadValidation {
  if (size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File must be 10 MB or smaller." };
  }
  if (size === 0) {
    return { ok: false, error: "File is empty." };
  }

  const mimeType = sniffMimeType(bytes);
  if (!mimeType) {
    return { ok: false, error: "File must be a PDF, JPG, PNG or WebP." };
  }

  return { ok: true, mimeType, extension: EXTENSIONS[mimeType] };
}

/**
 * Storage key layout: <professional_id>/<document_type>/<uuid>.<ext>
 * The first segment carries ownership and is what the storage RLS policy checks.
 */
export function buildStorageKey(
  professionalId: string,
  documentType: string,
  extension: string,
): string {
  return `${professionalId}/${documentType}/${crypto.randomUUID()}.${extension}`;
}

export const DOCUMENT_BUCKET = "professional-documents";

/** Signed URLs are deliberately short-lived; documents are never public. */
export const SIGNED_URL_TTL_SECONDS = 60;

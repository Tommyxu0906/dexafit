import { describe, expect, it } from "vitest";
import {
  DOCUMENT_BUCKET,
  PHOTO_BUCKET,
  bucketForDocumentType,
  isAllowedForDocumentType,
  isPubliclyServed,
  sniffMimeType,
  validateUpload,
} from "../../storage";

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
// An executable renamed "license.pdf" — the case the sniffing exists for.
const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]);

describe("upload validation", () => {
  it("identifies allowed types by magic bytes", () => {
    expect(sniffMimeType(pdf)).toBe("application/pdf");
    expect(sniffMimeType(jpeg)).toBe("image/jpeg");
    expect(sniffMimeType(png)).toBe("image/png");
    expect(sniffMimeType(webp)).toBe("image/webp");
  });

  it("rejects a disallowed file regardless of its filename or declared type", () => {
    expect(sniffMimeType(elf)).toBeNull();
    const result = validateUpload(elf, elf.length);
    expect(result.ok).toBe(false);
  });

  it("rejects files over 10 MB", () => {
    const result = validateUpload(pdf, 11 * 1024 * 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/10 MB/);
  });

  it("rejects empty files", () => {
    expect(validateUpload(new Uint8Array(), 0).ok).toBe(false);
  });

  it("accepts a valid PDF and reports its extension", () => {
    const result = validateUpload(pdf, pdf.length);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe("application/pdf");
      expect(result.extension).toBe("pdf");
    }
  });
});

describe("which bucket a document belongs in", () => {
  // Photos are displayed on the public marketplace; credentials are not. They
  // used to share one private bucket, so making it public to serve photos —
  // the obvious next step for whoever builds the profile page — would have
  // published every licence at a permanent unauthenticated URL.
  it("sends only profile photos to the public bucket", () => {
    expect(bucketForDocumentType("PROFILE_PHOTO")).toBe(PHOTO_BUCKET);
    for (const type of ["CREDENTIAL", "INSURANCE_CERTIFICATE", "OTHER"]) {
      expect(bucketForDocumentType(type), `${type} must stay private`).toBe(
        DOCUMENT_BUCKET,
      );
    }
  });

  it("does not treat an unknown type as public", () => {
    // A new document type added later defaults to private. Getting this
    // backwards publishes it.
    expect(bucketForDocumentType("SOMETHING_NEW")).toBe(DOCUMENT_BUCKET);
    expect(bucketForDocumentType("")).toBe(DOCUMENT_BUCKET);
    expect(isPubliclyServed("SOMETHING_NEW")).toBe(false);
  });

  it("refuses a PDF as a profile photo", () => {
    // A public bucket that accepts documents is a leak waiting for a mistake,
    // and a PDF is never a profile photo.
    expect(isAllowedForDocumentType("PROFILE_PHOTO", "application/pdf")).toBe(false);
    for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
      expect(isAllowedForDocumentType("PROFILE_PHOTO", mime), mime).toBe(true);
    }
  });

  it("still accepts a PDF as a credential", () => {
    expect(isAllowedForDocumentType("CREDENTIAL", "application/pdf")).toBe(true);
  });
});

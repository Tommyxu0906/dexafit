import { describe, expect, it } from "vitest";
import { sniffMimeType, validateUpload } from "../../storage";

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

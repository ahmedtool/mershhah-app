// Server-side copy of the platform's public-form upload limits. The browser
// enforces the same numbers for UX (artifacts/mershhah/src/lib/form-fields.ts:
// PLATFORM_FILE_RULES / PLATFORM_CV_RULES) - THIS file is the one that
// actually stops an oversized or disallowed upload, so keep the two in sync.
//
// 4 MB, not more: Vercel serverless functions reject request bodies above
// 4.5 MB before our code ever runs, so the cap has to sit below that.
export const FORM_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

export type DetectedFile = { kind: "image" | "pdf"; ext: string };

// Identifies a file by its real leading bytes rather than trusting the
// client's filename or Content-Type - both are trivially spoofed (an .exe
// renamed to .pdf keeps a .pdf name and can claim application/pdf).
export function detectFileType(buf: Buffer): DetectedFile | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { kind: "image", ext: "jpg" };
  }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { kind: "image", ext: "png" };
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return { kind: "image", ext: "webp" };
  }
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-") {
    return { kind: "pdf", ext: "pdf" };
  }
  return null;
}

// Which detected kinds a public form may receive (images + PDF today).
export const FORM_UPLOAD_ALLOWED_KINDS: ReadonlyArray<DetectedFile["kind"]> = ["image", "pdf"];

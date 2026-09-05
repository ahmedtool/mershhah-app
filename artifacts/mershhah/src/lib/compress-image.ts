// Shrinks large photos before upload without a visible quality hit:
// downscale to a sane display size (menu/offer images are never shown
// bigger than this anyway) and re-encode at a high JPEG quality where a
// human eye can't tell the difference. PNGs are kept as PNG (lossless,
// resize-only) so logos with transparent backgrounds aren't broken.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;
const SKIP_BELOW_BYTES = 200 * 1024;

export async function compressImage(file: File): Promise<Blob> {
  if (file.size < SKIP_BELOW_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const isPng = file.type === 'image/png';
  const outputType = isPng ? 'image/png' : 'image/jpeg';

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob && blob.size < file.size ? blob : file),
      outputType,
      isPng ? undefined : JPEG_QUALITY,
    );
  });
}

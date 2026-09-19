export type FormUploadContext = { restaurantId: string; serviceType: string };

export type FormUploadErrorCode = 'file_too_large' | 'file_type_not_allowed' | 'rate_limited' | 'form_not_available' | 'upload_failed';

export class FormUploadError extends Error {
  code: FormUploadErrorCode;
  constructor(code: FormUploadErrorCode) {
    super(code);
    this.code = code;
  }
}

// Public forms upload through our own server (POST /api/form-upload), which
// checks size and the file's real type before storing it - visitors are
// anonymous, so they are never handed a reusable storage signature.
// Sent as raw bytes with a neutral content type so no body parser upstream
// tries to interpret it.
export async function uploadFormFile(blob: Blob, ctx: FormUploadContext): Promise<string> {
  const params = new URLSearchParams({ restaurantId: ctx.restaurantId, serviceType: ctx.serviceType });
  let res: Response;
  try {
    res = await fetch('/api/form-upload?' + params.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: blob,
    });
  } catch {
    throw new FormUploadError('upload_failed');
  }
  if (!res.ok) {
    let code: FormUploadErrorCode = 'upload_failed';
    try {
      const body = await res.json();
      if (['file_too_large', 'file_type_not_allowed', 'rate_limited', 'form_not_available'].includes(body?.error)) code = body.error;
    } catch {}
    throw new FormUploadError(code);
  }
  const data = await res.json();
  return data.url as string;
}

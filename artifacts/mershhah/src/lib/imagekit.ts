import { compressImage } from '@/lib/compress-image';
import { supabase } from '@/lib/supabase';

const UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";

type AuthParams = { token: string; expire: number; signature: string; publicKey: string };

async function getAuthParams(): Promise<AuthParams> {
  // The signature endpoint only serves logged-in owners/admins now.
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/imagekit/auth", {
    headers: session?.access_token ? { Authorization: "Bearer " + session.access_token } : {},
  });
  if (!res.ok) throw new Error("Failed to get upload authorization");
  return res.json();
}

/**
 * Uploads a file straight from the browser to ImageKit (the private key
 * never leaves the server — only a short-lived signature does) and returns
 * the final, ready-to-store image URL.
 */
export async function uploadToImageKit(file: File | Blob, folder: string, fileName?: string): Promise<string> {
  const { token, expire, signature, publicKey } = await getAuthParams();
  const resolvedName = fileName ?? (file instanceof File ? file.name : `${Date.now()}.jpg`);
  const toUpload = file instanceof File ? await compressImage(file) : file;

  const formData = new FormData();
  formData.append("file", toUpload, resolvedName);
  formData.append("fileName", resolvedName);
  formData.append("publicKey", publicKey);
  formData.append("signature", signature);
  formData.append("expire", String(expire));
  formData.append("token", token);
  formData.append("folder", folder);
  formData.append("useUniqueFileName", "true");

  const res = await fetch(UPLOAD_URL, { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Image upload failed");
  return data.url as string;
}

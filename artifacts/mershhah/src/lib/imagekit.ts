const UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";

type AuthParams = { token: string; expire: number; signature: string; publicKey: string };

async function getAuthParams(): Promise<AuthParams> {
  const res = await fetch("/api/imagekit/auth");
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

  const formData = new FormData();
  formData.append("file", file, resolvedName);
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

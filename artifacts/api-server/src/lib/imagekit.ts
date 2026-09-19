import ImageKit from "imagekit";

export function getImageKit(): ImageKit {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error("ImageKit is not configured (IMAGEKIT_PUBLIC_KEY/IMAGEKIT_PRIVATE_KEY/IMAGEKIT_URL_ENDPOINT)");
  }
  return new ImageKit({ publicKey, privateKey, urlEndpoint });
}

import { Router, type IRouter } from "express";
import ImageKit from "imagekit";

const router: IRouter = Router();

function getImageKit(): ImageKit {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error("ImageKit is not configured (IMAGEKIT_PUBLIC_KEY/IMAGEKIT_PRIVATE_KEY/IMAGEKIT_URL_ENDPOINT)");
  }
  return new ImageKit({ publicKey, privateKey, urlEndpoint });
}

// GET /api/imagekit/auth — short-lived signature the browser needs to upload
// straight to ImageKit without ever seeing the private key.
router.get("/auth", (req, res) => {
  try {
    const imagekit = getImageKit();
    const { token, expire, signature } = imagekit.getAuthenticationParameters();
    res.json({ token, expire, signature, publicKey: process.env.IMAGEKIT_PUBLIC_KEY });
  } catch (error: any) {
    console.error("ImageKit auth error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;

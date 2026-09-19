import { Router, type IRouter } from "express";
import { getImageKit } from "../lib/imagekit";
import { requireOwnerOrAdmin } from "../middleware/requireOwnerOrAdmin";

const router: IRouter = Router();

// GET /api/imagekit/auth — short-lived signature the browser needs to upload
// straight to ImageKit without ever seeing the private key. A signature can't
// restrict file size or type, so it is only handed to logged-in owners/admins
// (dashboard image uploads). Anonymous visitors uploading through public forms
// go through POST /api/form-upload instead, which validates the file itself.
router.get("/auth", requireOwnerOrAdmin, (req, res) => {
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

import express, { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { getImageKit } from "../lib/imagekit";
import { getServiceClient } from "../lib/supabase";
import { FORM_UPLOAD_ALLOWED_KINDS, FORM_UPLOAD_MAX_BYTES, detectFileType } from "../lib/upload-rules";

const router: IRouter = Router();

// POST /api/form-upload?restaurantId=...&serviceType=...
//
// The ONLY way a public form (jobs CV, franchise/custom "file" fields, ...)
// gets a file into storage. Visitors are anonymous, so instead of handing
// them a reusable ImageKit signature (which can't restrict size or type and
// let anyone upload anything to our account), the file comes here, gets
// checked, and only then is uploaded with our private key.
//
// The body is the raw file bytes (Content-Type: application/octet-stream) -
// no multipart parser needed, and express.json/urlencoded upstream ignore it.

// Best-effort abuse brake. This is per serverless instance memory, so it
// stops a script hammering one instance but is not a global counter.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 10;
const MAX_PER_RESTAURANT = 60;
const hits = new Map<string, number[]>();

function overLimit(key: string, max: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

const SERVICE_TYPE_RE = /^(jobs|franchise|wholesale|corporate|partnership|custom:[A-Za-z0-9]{1,64})$/;

router.post(
  "/",
  express.raw({ type: () => true, limit: FORM_UPLOAD_MAX_BYTES }),
  async (req: Request, res: Response) => {
    try {
      const restaurantId = String(req.query.restaurantId || "");
      const serviceType = String(req.query.serviceType || "");
      if (!restaurantId || restaurantId.length > 100 || !SERVICE_TYPE_RE.test(serviceType)) {
        return res.status(400).json({ error: "bad_request" });
      }

      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        return res.status(400).json({ error: "empty_file" });
      }
      if (body.length > FORM_UPLOAD_MAX_BYTES) {
        return res.status(413).json({ error: "file_too_large" });
      }

      const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
      if (overLimit("ip:" + ip, MAX_PER_IP) || overLimit("rest:" + restaurantId, MAX_PER_RESTAURANT)) {
        return res.status(429).json({ error: "rate_limited" });
      }

      const detected = detectFileType(body);
      if (!detected || !FORM_UPLOAD_ALLOWED_KINDS.includes(detected.kind)) {
        return res.status(415).json({ error: "file_type_not_allowed" });
      }

      // Only accept uploads for a form that exists and is switched on - a
      // random restaurantId (or a disabled/draft form) can't be used as a
      // free file host.
      const supabase = getServiceClient();
      const { data: svc } = await supabase
        .from("business_gateway_services")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("service_type", serviceType)
        .eq("is_enabled", true)
        .maybeSingle();
      if (!svc) {
        return res.status(404).json({ error: "form_not_available" });
      }

      // The stored name is generated here, never taken from the client: the
      // visitor's original filename is kept separately (client-side) purely
      // for display.
      const fileName = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10) + "." + detected.ext;
      const uploaded = await getImageKit().upload({
        file: body,
        fileName,
        folder: "form-uploads/" + restaurantId,
        useUniqueFileName: true,
      });

      return res.json({ url: uploaded.url });
    } catch (error: any) {
      console.error("form-upload error:", error);
      return res.status(500).json({ error: "upload_failed" });
    }
  },
);

// body-parser throws (413) when the body exceeds the raw limit - turn that
// into the same JSON error shape the client already understands.
router.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err?.type === "entity.too.large" || err?.status === 413) {
    return res.status(413).json({ error: "file_too_large" });
  }
  return next(err);
});

export default router;

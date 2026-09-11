import type { NextFunction, Request, Response } from "express";
import { getServiceClient } from "../lib/supabase";

// These AI endpoints call a paid third-party provider (OpenAI/Mistral) per
// request with no per-account attribution or rate limit of their own -
// without this, they were reachable by anyone on the internet, logged in or
// not, and every call was billed to mershhah regardless of who sent it.
// Restricting to owner/admin accounts at least ties usage to a real,
// identifiable account and matches who these dashboard tools are actually
// built for (restaurant-chat is the one deliberate exception - it's the
// public chat widget on a restaurant's own menu page, called by anonymous
// visitors by design, and is mounted without this middleware).
export async function requireOwnerOrAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const supabase = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  } catch (error: any) {
    console.error("[requireOwnerOrAdmin]", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
}

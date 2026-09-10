import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

function getServiceClient() {
  // The project URL isn't secret (it's already shipped to the browser as
  // VITE_SUPABASE_URL), so reuse whichever of these is already set rather
  // than requiring a second copy of the same value in Vercel.
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service role is not configured (SUPABASE_URL or VITE_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(url, serviceRoleKey);
}

// POST /api/auth/check-existing-account — called right after a fresh
// Google/OTP sign-in, before deciding whether to send the visitor to
// onboarding. `profiles` RLS only lets a session read its OWN row, so the
// client can't see whether some OTHER auth identity already registered
// this same email (e.g. a password-based account signing in with Google
// for the first time - a different provider, and without account linking
// configured, Supabase gives it a brand-new auth.users id). This runs with
// the service role specifically to answer that one narrow question.
router.post("/check-existing-account", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "unauthorized" });

    const supabase = getServiceClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user || !user.email) return res.status(401).json({ error: "unauthorized" });

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", user.email)
      .neq("id", user.id)
      .maybeSingle();

    return res.json({ existingAccountFound: !!existing });
  } catch (error: any) {
    console.error("check-existing-account error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;

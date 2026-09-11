import { Router, type IRouter } from "express";
import { getServiceClient } from "../lib/supabase";

const router: IRouter = Router();

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

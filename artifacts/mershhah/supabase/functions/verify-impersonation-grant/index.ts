import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Called by OtpGate right after an admin enters a restaurant's dashboard via
// an owner-approved grant (see enter-owner-account). Confirms the request is
// still approved/unexpired AND belongs to the restaurant owned by whoever is
// asking (the caller's own session - now the owner's, since the magic link
// signs the browser tab in as them) before letting OtpGate skip the OTP step.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ valid: false }, 401);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ valid: false }, 401);

    const { requestId } = await req.json();
    if (!requestId) return json({ valid: false }, 400);

    const { data: request } = await supabase
      .from("impersonation_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    if (!request || request.status !== "approved") return json({ valid: false });
    if (!request.expires_at || new Date(request.expires_at) < new Date()) return json({ valid: false });

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("owner_id")
      .eq("id", request.restaurant_id)
      .single();
    if (restaurant?.owner_id !== user.id) return json({ valid: false });

    // The owner's own approval of this grant stands in for OTP - stamp the
    // same otp_verified_at column the real OTP flow uses, so the access
    // token hook's otp_ok claim reflects it once the client refreshes its
    // session (the magic-link sign-in already happened before this check
    // ever runs, so the current JWT still carries the pre-grant claim).
    await supabase.from("profiles").update({ otp_verified_at: new Date().toISOString() }).eq("id", user.id);

    return json({ valid: true });
  } catch (error) {
    console.error("[verify-impersonation-grant] Fatal error:", error);
    return json({ valid: false }, 500);
  }
});

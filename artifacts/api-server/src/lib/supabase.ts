import { createClient } from "@supabase/supabase-js";

export function getServiceClient() {
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

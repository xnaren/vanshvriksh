// Admin Supabase client — SERVICE ROLE key. BYPASSES Row Level Security.
// Use ONLY inside server actions / route handlers, NEVER in client code.
// Used for: username → email lookup (login), username-availability check
// (signup), and creating the profiles row after OTP verification.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — add it to .env.local (see .env.example)"
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Server-side Supabase client (server components, server actions, route handlers).
// Reads/writes the auth session via cookies. RLS still applies — this client
// acts as the logged-in user, NOT as an admin.
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookies can only be modified
            // in Server Actions / Route Handlers. The middleware refreshes
            // the session on the next request, so this is safe to ignore.
          }
        },
      },
    }
  );
}

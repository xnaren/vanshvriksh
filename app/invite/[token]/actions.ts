// Server action for accepting an invite link.
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvite(token: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/invite/${token}`);

  // SECURITY DEFINER function: validates expiry server-side, adds membership.
  const { data, error } = await supabase.rpc("accept_invite", {
    p_token: token,
  });
  if (error) throw new Error(error.message);

  redirect(`/trees/${data as string}`);
}

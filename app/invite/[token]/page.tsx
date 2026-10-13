// Invite landing: shows what you're joining, then accepts on click.
// Works for logged-out visitors too (prompts login first, preserving the link).
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite } from "./actions";

interface InviteInfo {
  valid: boolean;
  tree_name?: string;
  role?: string;
}

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // SECURITY DEFINER function — safe to call for non-members.
  const { data } = await supabase.rpc("get_invite_info", {
    p_token: params.token,
  });
  const info = (data ?? { valid: false }) as InviteInfo;

  async function accept() {
    "use server";
    await acceptInvite(params.token);
  }

  return (
    <div className="max-w-md mx-auto py-16">
      <div className="card text-center space-y-4">
        <div className="text-5xl">🌳</div>
        {!info.valid ? (
          <>
            <h1 className="text-xl font-bold">Invite not valid</h1>
            <p className="text-sm text-stone-600">
              This link is expired, already used, or doesn&apos;t exist. Ask
              your relative for a fresh one.
            </p>
            <Link href="/" className="btn-secondary inline-block">
              Back home
            </Link>
          </>
        ) : !user ? (
          <>
            <h1 className="text-xl font-bold">
              You&apos;re invited to join “{info.tree_name}”
            </h1>
            <p className="text-sm text-stone-600">
              You&apos;ll join as <strong>{info.role}</strong>. Log in or create
              an account first — you&apos;ll land right back here.
            </p>
            <div className="flex gap-2 justify-center">
              <Link
                href={`/login?next=/invite/${params.token}`}
                className="btn-primary"
              >
                Log in
              </Link>
              <Link href="/signup" className="btn-secondary">
                Sign up
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">
              Join “{info.tree_name}”?
            </h1>
            <p className="text-sm text-stone-600">
              You&apos;ll join as <strong>{info.role}</strong> and can start
              exploring the family tree right away.
            </p>
            <form action={accept}>
              <button type="submit">Accept invite</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

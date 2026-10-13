// Cloudflare Turnstile verification (server-side only).
// The widget renders in the browser (components/TurnstileWidget.tsx); the
// token it produces is verified HERE before any OTP is sent. This ordering —
// captcha first, OTP second — is what stops bots from burning email/SMS quota.

export async function verifyTurnstile(
  token: string,
  remoteIp?: string | null
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // TODO(narendra): set TURNSTILE_SECRET_KEY from the Cloudflare dashboard
  // (Turnstile → your site → Settings) before deploying anywhere public.
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("TURNSTILE_SECRET_KEY is not set");
    }
    // Local dev (e.g. Codespaces + `supabase start`) without Cloudflare keys:
    // skip the bot check so the OTP flow can be tested end-to-end. This
    // branch is unreachable in production (see above).
    console.warn("[turnstile] no secret key — skipping verification (dev only)");
    return true;
  }
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    }
  );
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

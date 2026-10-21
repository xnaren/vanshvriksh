// Login page — passwordless: username → Turnstile bot-check → email OTP.
// Honors ?next= for post-login redirects (e.g. from invite links).
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TurnstileWidget from "@/components/TurnstileWidget";
import { requestLoginOtp, verifyLoginOtp } from "./actions";
import { devSignIn } from "./dev-actions";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!captchaToken) {
      setError("Please complete the bot check first.");
      return;
    }
    setBusy(true);
    const res = await requestLoginOtp(username, captchaToken);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setHint(res.hint ?? "");
    setStep(2);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await verifyLoginOtp(username, otp);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-1">Namaste 🙏</h1>
      <p className="text-stone-600 mb-6 text-sm">
        Log in to your family trees — no password, just your username, a
        quick bot check, and a code emailed to you.
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={handleRequest} className="card space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. ramesh_sharma"
              autoComplete="username"
              required
            />
          </div>
          <TurnstileWidget onVerify={setCaptchaToken} />
          <button type="submit" disabled={busy}>
            {busy ? "Sending code…" : "Send me a code"}
          </button>
          <p className="text-sm text-stone-500">
            New here?{" "}
            <a href="/signup" className="text-emerald-700 underline">
              Create an account
            </a>
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="card space-y-4">
          <p className="text-sm text-stone-600">
            We sent a 6-digit code to <strong>{hint}</strong>. Enter it below.
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Code</label>
            <input
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </div>
          <button type="submit" disabled={busy}>
            {busy ? "Verifying…" : "Log in"}
          </button>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => {
              setStep(1);
              setCaptchaToken(null);
              setOtp("");
            }}
          >
            Use a different username
          </button>
        </form>
      )}

      {/* DEV-ONLY: one-click sign-in for local development. Not rendered in
          production builds (NODE_ENV is inlined at build time), and the
          server action itself refuses to run in production. Remove along
          with app/login/dev-actions.ts before going live. */}
      {process.env.NODE_ENV !== "production" && (
        <form action={devSignIn} className="mt-4">
          <button type="submit" className="btn-secondary w-full">
            ⚙️ Dev sign-in (one click, local only)
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto px-4 py-10">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

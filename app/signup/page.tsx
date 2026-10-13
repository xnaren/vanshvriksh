// Signup page — passwordless: username + email → Turnstile → email OTP.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TurnstileWidget from "@/components/TurnstileWidget";
import { requestSignupOtp, verifySignupOtp } from "./actions";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
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
    const res = await requestSignupOtp(username, email, captchaToken);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setStep(2);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await verifySignupOtp(username, email, otp);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto py-10">
      <h1 className="text-2xl font-bold mb-1">Create your account</h1>
      <p className="text-stone-600 mb-6 text-sm">
        Pick a username, prove you&apos;re human, and confirm your email with a
        code. No password, ever.
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
            <p className="text-xs text-stone-500 mt-1">
              3–30 characters: lowercase letters, numbers, underscore.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <p className="text-xs text-stone-500 mt-1">
              We&apos;ll send your login codes here. Phone OTP comes later.
            </p>
          </div>
          <TurnstileWidget onVerify={setCaptchaToken} />
          <button type="submit" disabled={busy}>
            {busy ? "Sending code…" : "Send me a code"}
          </button>
          <p className="text-sm text-stone-500">
            Already have an account?{" "}
            <a href="/login" className="text-emerald-700 underline">
              Log in
            </a>
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="card space-y-4">
          <p className="text-sm text-stone-600">
            We sent a 6-digit code to <strong>{email}</strong>. Enter it to
            finish creating your account.
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Code</label>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </div>
          <button type="submit" disabled={busy}>
            {busy ? "Verifying…" : "Create account"}
          </button>
        </form>
      )}
    </div>
  );
}

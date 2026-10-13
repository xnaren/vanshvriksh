// Cloudflare Turnstile bot-check widget ("type the code you see" step).
// Renders the challenge and calls onVerify with the token, which the page
// then passes to a server action for verification BEFORE any OTP is sent.
"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void }
      ) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

export default function TurnstileWidget({
  onVerify,
}: {
  onVerify: (token: string) => void;
}) {
  // TODO(narendra): set NEXT_PUBLIC_TURNSTILE_SITE_KEY from the Cloudflare
  // dashboard (Turnstile → your site → Settings).
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const ref = useRef<HTMLDivElement>(null);
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;

  useEffect(() => {
    if (!siteKey) return;

    const renderWidget = () => {
      if (
        window.turnstile &&
        ref.current &&
        ref.current.childElementCount === 0
      ) {
        window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token: string) => onVerifyRef.current(token),
        });
      }
    };

    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = renderWidget;
      document.head.appendChild(s);
    } else {
      renderWidget();
    }
  }, [siteKey]);

  if (!siteKey) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
        Turnstile site key not configured — set NEXT_PUBLIC_TURNSTILE_SITE_KEY.
      </p>
    );
  }

  return <div ref={ref} />;
}

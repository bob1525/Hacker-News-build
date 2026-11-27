"use client";

import { useState } from "react";
import { resendVerificationEmail } from "@/lib/actions/email-verification";
import { buttonClass } from "@/components/styles";

export function ResendVerificationButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function resend() {
    setPending(true);
    const result = await resendVerificationEmail();
    setPending(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage(result.data.sent ? "Verification email sent." : "This email is already verified.");
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={resend} disabled={pending} className={buttonClass}>
        {pending ? "Sending…" : "Resend verification email"}
      </button>
      {message ? <p className="mt-2 text-[13px]">{message}</p> : null}
    </div>
  );
}

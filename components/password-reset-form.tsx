"use client";

import { useActionState, useState } from "react";
import { completePasswordResetAction, requestPasswordResetAction } from "@/lib/actions/password-reset";
import { buttonClass, inputClass } from "@/components/styles";
import type { FormState } from "@/lib/types";

const initialState: FormState = {};

export function PasswordResetForm({ mode, token = "" }: { mode: "request" | "complete"; token?: string }) {
  const action = mode === "request" ? requestPasswordResetAction : completePasswordResetAction;
  const [state, submit, pending] = useActionState(action, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={submit} noValidate className="mt-3 max-w-sm space-y-3">
      {mode === "complete" ? <input type="hidden" name="token" value={token} /> : null}
      {mode === "request" ? (
        <div>
          <label htmlFor="reset-email" className="mb-1 block text-[12px]">
            Email
          </label>
          <input
            id="reset-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            maxLength={120}
            className={inputClass}
            aria-invalid={Boolean(state.fieldErrors?.email)}
          />
          {state.fieldErrors?.email ? <p className="mt-1 text-[12px] text-hn-danger">{state.fieldErrors.email}</p> : null}
        </div>
      ) : (
        <div>
          <label htmlFor="reset-password" className="mb-1 block text-[12px]">
            New password
          </label>
          <input
            id="reset-password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            maxLength={72}
            className={inputClass}
            aria-invalid={Boolean(state.fieldErrors?.password)}
          />
          {state.fieldErrors?.password ? (
            <p className="mt-1 text-[12px] text-hn-danger">{state.fieldErrors.password}</p>
          ) : null}
        </div>
      )}
      {state.error ? (
        <p role="alert" className="text-[12px] text-hn-danger">
          {state.error}
        </p>
      ) : null}
      {state.notice ? <p className="text-[12px]">{state.notice}</p> : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "working…" : mode === "request" ? "send reset link" : "update password"}
      </button>
    </form>
  );
}

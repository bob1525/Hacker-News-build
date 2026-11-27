"use client";

import { useActionState, useState } from "react";
import { confirmEmailChangeAction, requestEmailChangeAction } from "@/lib/actions/email-change";
import { buttonClass, inputClass } from "@/components/styles";
import type { FormState } from "@/lib/types";

const initialState: FormState = {};

export function EmailChangeForm({ mode = "request", token = "" }: { mode?: "request" | "confirm"; token?: string }) {
  const action = mode === "request" ? requestEmailChangeAction : confirmEmailChangeAction;
  const [state, submit, pending] = useActionState(action, initialState);
  const [email, setEmail] = useState("");

  return (
    <form action={submit} noValidate className="max-w-sm space-y-2">
      {mode === "confirm" ? <input type="hidden" name="token" value={token} /> : null}
      {mode === "request" ? (
        <div>
          <label htmlFor="email-change" className="mb-1 block text-[12px]">
            New email
          </label>
          <input
            id="email-change"
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
        <p className="text-[12px] text-hn-sub">This confirms the address in the email. The old address stays until you do.</p>
      )}
      {state.error ? (
        <p role="alert" className="text-[12px] text-hn-danger">
          {state.error}
        </p>
      ) : null}
      {state.notice ? <p className="text-[12px]">{state.notice}</p> : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "working…" : mode === "request" ? "send confirmation" : "confirm new email"}
      </button>
    </form>
  );
}

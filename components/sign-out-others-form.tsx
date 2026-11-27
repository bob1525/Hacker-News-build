"use client";

import { useActionState } from "react";
import { signOutOtherDevicesAction } from "@/lib/actions/session";
import { buttonClass } from "@/components/styles";
import type { FormState } from "@/lib/types";

const initialState: FormState = {};

export function SignOutOthersForm() {
  const [state, submit, pending] = useActionState(signOutOtherDevicesAction, initialState);

  return (
    <form action={submit} className="max-w-sm space-y-2">
      <p className="text-[12px] text-hn-sub">Sign out every other browser. This one stays signed in.</p>
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Signing out…" : "Sign out other devices"}
      </button>
      {state.error ? (
        <p role="alert" className="text-[12px] text-hn-danger">
          {state.error}
        </p>
      ) : null}
      {state.notice ? <p className="text-[12px] text-hn-sub">{state.notice}</p> : null}
    </form>
  );
}

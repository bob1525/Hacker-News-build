"use client";

import { useActionState, useState } from "react";
import { login, register } from "@/lib/actions/auth";
import type { FormState } from "@/lib/types";
import { buttonClass, inputClass } from "@/components/styles";

const initialState: FormState = {};

export function AuthForm({ mode, nextPath }: { mode: "login" | "register"; nextPath: string }) {
  const action = mode === "login" ? login : register;
  const [state, submit, pending] = useActionState(action, initialState);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={submit} noValidate className="mt-3 max-w-sm space-y-3">
      <input type="hidden" name="next" value={nextPath} />
      <div>
        <label htmlFor={`${mode}-username`} className="mb-1 block text-[12px]">
          Username
        </label>
        <input
          id={`${mode}-username`}
          name="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          maxLength={15}
          className={inputClass}
          aria-invalid={Boolean(state.fieldErrors?.username)}
        />
        {state.fieldErrors?.username ? (
          <p className="mt-1 text-[12px] text-hn-danger">{state.fieldErrors.username}</p>
        ) : null}
      </div>
      {mode === "register" ? (
        <div>
          <label htmlFor="email" className="mb-1 block text-[12px]">
            Email
          </label>
          <input
            id="email"
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
      ) : null}
      <div>
        <label htmlFor={`${mode}-password`} className="mb-1 block text-[12px]">
          Password
        </label>
        <input
          id={`${mode}-password`}
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          maxLength={72}
          className={inputClass}
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
        {state.fieldErrors?.password ? (
          <p className="mt-1 text-[12px] text-hn-danger">{state.fieldErrors.password}</p>
        ) : null}
      </div>
      {state.error ? (
        <p role="alert" className="text-[12px] text-hn-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "working…" : mode === "login" ? "login" : "create account"}
      </button>
    </form>
  );
}

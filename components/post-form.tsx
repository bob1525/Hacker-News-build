"use client";

import { useActionState, useState } from "react";
import { createPost } from "@/lib/actions/posts";
import type { FormState } from "@/lib/types";
import { buttonClass, inputClass } from "@/components/styles";

const initialState: FormState = {};

export function PostForm() {
  const [state, submit, pending] = useActionState(createPost, initialState);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");

  return (
    <form action={submit} noValidate className="mt-3 max-w-xl space-y-3">
      <div>
        <label htmlFor="title" className="mb-1 block text-[12px]">
          Title
        </label>
        <input
          id="title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          className={inputClass}
          aria-invalid={Boolean(state.fieldErrors?.title)}
        />
        {state.fieldErrors?.title ? <p className="mt-1 text-[12px] text-hn-danger">{state.fieldErrors.title}</p> : null}
      </div>
      <div>
        <label htmlFor="url" className="mb-1 block text-[12px]">
          URL
        </label>
        <input
          id="url"
          name="url"
          type="text"
          inputMode="url"
          placeholder="https://"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          maxLength={500}
          className={inputClass}
          aria-invalid={Boolean(state.fieldErrors?.url)}
        />
        {state.fieldErrors?.url ? <p className="mt-1 text-[12px] text-hn-danger">{state.fieldErrors.url}</p> : null}
      </div>
      <div>
        <label htmlFor="text" className="mb-1 block text-[12px]">
          Text
        </label>
        <textarea
          id="text"
          name="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={8}
          maxLength={5000}
          className={`${inputClass} leading-relaxed`}
        />
        {state.fieldErrors?.text ? <p className="mt-1 text-[12px] text-hn-danger">{state.fieldErrors.text}</p> : null}
      </div>
      {state.error ? (
        <p role="alert" className="text-[12px] text-hn-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "submitting…" : "submit"}
      </button>
    </form>
  );
}

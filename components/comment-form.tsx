"use client";

import { useActionState, useState } from "react";
import { createComment } from "@/lib/actions/comments";
import type { FormState } from "@/lib/types";
import { buttonClass, inputClass } from "@/components/styles";

const initialState: FormState = {};

export function CommentForm({
  postId,
  parentId,
  autoFocus = false,
  label,
}: {
  postId: string;
  parentId?: string;
  autoFocus?: boolean;
  label?: string;
}) {
  const [state, submit, pending] = useActionState(createComment, initialState);
  const [text, setText] = useState("");
  const fieldId = `comment-${parentId ?? "root"}`;
  const submitLabel = label ?? (parentId ? "post reply" : "add comment");

  return (
    <form action={submit} noValidate className="mt-2 max-w-2xl space-y-1.5">
      <input type="hidden" name="postId" value={postId} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <label htmlFor={fieldId} className="sr-only">
        Comment
      </label>
      <textarea
        id={fieldId}
        name="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={4000}
        rows={parentId ? 3 : 6}
        autoFocus={autoFocus}
        placeholder={parentId ? "Write a reply" : "Share a comment"}
        className={`${inputClass} leading-relaxed`}
      />
      {state.error ? (
        <p role="alert" className="text-[12px] text-hn-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "posting…" : submitLabel}
      </button>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { updateComment } from "@/lib/actions/comments";
import type { FormState } from "@/lib/types";
import { buttonClass, inputClass } from "@/components/styles";

const initialState: FormState = {};

export function EditCommentForm({ commentId, initialText }: { commentId: string; initialText: string }) {
  const [state, submit, pending] = useActionState(updateComment, initialState);
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (state.refresh) window.location.reload();
  }, [state.refresh]);

  return (
    <form action={submit} noValidate className="mt-1 max-w-2xl space-y-1.5">
      <input type="hidden" name="commentId" value={commentId} />
      <label htmlFor={`edit-${commentId}`} className="sr-only">
        Edit comment
      </label>
      <textarea
        id={`edit-${commentId}`}
        name="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={4000}
        rows={4}
        className={`${inputClass} leading-relaxed`}
      />
      {state.error ? (
        <p role="alert" className="text-[12px] text-hn-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "saving…" : "save"}
      </button>
    </form>
  );
}

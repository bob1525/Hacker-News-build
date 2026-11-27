import { isSafeHttpUrl } from "@/lib/domain/url";

export type TextPart =
  | { type: "text"; value: string }
  | { type: "link"; href: string; value: string };

const URL_PATTERN = /https?:\/\/[^\s<]+/gi;

function pushText(parts: TextPart[], value: string) {
  if (!value) return;
  const last = parts[parts.length - 1];
  if (last?.type === "text") {
    last.value += value;
    return;
  }
  parts.push({ type: "text", value });
}

export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const index = match.index ?? 0;
    if (index > cursor) pushText(parts, text.slice(cursor, index));

    const href = raw.replace(/[),.;!?]+$/g, "");
    const trailing = raw.slice(href.length);
    if (isSafeHttpUrl(href)) {
      parts.push({ type: "link", href, value: href });
      pushText(parts, trailing);
    } else {
      pushText(parts, raw);
    }
    cursor = index + raw.length;
  }

  if (cursor < text.length) pushText(parts, text.slice(cursor));
  if (parts.length === 0) parts.push({ type: "text", value: text });
  return parts;
}

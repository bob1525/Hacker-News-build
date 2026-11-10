import { linkify } from "@/lib/domain/text";

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const parts = linkify(text);
  return (
    <p className={`whitespace-pre-wrap break-words ${className}`.trim()}>
      {parts.map((part, index) =>
        part.type === "link" ? (
          <a
            key={`${part.href}-${index}`}
            href={part.href}
            className="underline"
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
          >
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </p>
  );
}

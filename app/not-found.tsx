import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <EmptyState
      title="No such page."
      hint="The story or user may have been removed, or the link is mistyped."
      action={{ href: "/", label: "Back to the front page" }}
    />
  );
}

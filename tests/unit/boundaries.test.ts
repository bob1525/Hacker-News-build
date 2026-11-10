import { describe, expect, it } from "vitest";
import { linkify } from "@/lib/domain/text";
import { commentSchema, postSchema } from "@/lib/validators";

describe("input boundaries", () => {
  it("rejects a title longer than 120 characters", () => {
    const title = "t".repeat(121);
    expect(postSchema.safeParse({ title, url: "", text: "body" }).success).toBe(false);
  });

  it("accepts a title of exactly 120 characters", () => {
    const title = "t".repeat(120);
    expect(postSchema.parse({ title, url: "", text: "body" }).title).toHaveLength(120);
  });

  it("rejects a title that is only whitespace", () => {
    expect(postSchema.safeParse({ title: " \n\t ", url: "https://example.com", text: "" }).success).toBe(false);
  });

  it("rejects a comment longer than 4000 characters", () => {
    expect(commentSchema.safeParse({ postId: "p", text: "c".repeat(4001) }).success).toBe(false);
  });

  it("accepts a comment of exactly 4000 characters", () => {
    expect(commentSchema.parse({ postId: "p", text: "c".repeat(4000) }).text).toHaveLength(4000);
  });

  it("rejects a comment that is only whitespace", () => {
    expect(commentSchema.safeParse({ postId: "p", text: " \n\t " }).success).toBe(false);
  });

  it("keeps emoji, CJK, quotes, and markup as plain text", () => {
    const title = `你好 <script>alert(1)</script> "quoted" 🚀`;
    const parsed = postSchema.parse({ title, url: "", text: "line one\nline two" });
    expect(parsed.title).toBe(title);
    expect(parsed.text).toContain("\n");
    const parts = linkify(title);
    expect(parts.every((part) => part.type === "text")).toBe(true);
    expect(parts.map((part) => part.value).join("")).toBe(title);
  });

  it("rejects a post with neither a url nor text", () => {
    expect(postSchema.safeParse({ title: "Only a title", url: "", text: "" }).success).toBe(false);
  });

  it("rejects a url longer than 500 characters", () => {
    const url = `https://example.com/${"a".repeat(500)}`;
    expect(postSchema.safeParse({ title: "Long url", url, text: "" }).success).toBe(false);
  });

  it("accepts punctuation and symbols in a comment", () => {
    const text = `It's fine: <>&"' \\ / \n\t — naïve`;
    expect(commentSchema.parse({ postId: "p", parentId: "", text }).text).toBe(text.trim());
  });
});

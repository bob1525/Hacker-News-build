import { describe, expect, it } from "vitest";
import { commentSchema, fieldErrors, loginSchema, postSchema, registerSchema } from "@/lib/validators";

describe("validators", () => {
  it("normalizes registration input", () => {
    const parsed = registerSchema.parse({
      username: " Nash ",
      email: "Nash@Example.com",
      password: "news12345",
    });
    expect(parsed).toEqual({ username: "nash", email: "nash@example.com", password: "news12345" });
  });

  it("rejects short passwords, bad usernames, and duplicate-looking whitespace", () => {
    const result = registerSchema.safeParse({ username: "a", email: "nope", password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors.username).toMatch(/at least 2/);
      expect(errors.email).toMatch(/valid email/);
      expect(errors.password).toMatch(/at least 8/);
    }
  });

  it("requires a title plus a url or text, and refuses unsafe urls", () => {
    const empty = postSchema.safeParse({ title: "   ", url: "", text: "" });
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(fieldErrors(empty.error).title).toMatch(/required/);
    }

    const script = postSchema.safeParse({ title: "Nope", url: "javascript:alert(1)", text: "" });
    expect(script.success).toBe(false);
    if (!script.success) {
      expect(fieldErrors(script.error).url).toMatch(/http/);
    }

    expect(postSchema.parse({ title: "Ask", url: "", text: "A discussion" }).text).toBe("A discussion");
    expect(postSchema.parse({ title: "Link", url: "https://example.com", text: "" }).url).toBe("https://example.com");
  });

  it("rejects an empty comment and accepts a reply", () => {
    expect(commentSchema.safeParse({ postId: "p1", text: "   " }).success).toBe(false);
    expect(commentSchema.parse({ postId: "p1", parentId: "c1", text: " nested " }).text).toBe("nested");
    expect(loginSchema.parse({ username: "PG", password: "secret" }).username).toBe("pg");
  });
});

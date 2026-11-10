import { z } from "zod";
import { isSafeHttpUrl } from "@/lib/domain/url";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Username must be at least 2 characters.")
  .max(15, "Username must be 15 characters or fewer.")
  .regex(/^[a-z0-9_]+$/, "Use letters, numbers, and underscores only.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email.")
  .max(120, "Email must be 120 characters or fewer.");

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "Password is required.").max(72),
});

export const postSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(120, "Title must be 120 characters or fewer."),
    url: z.string().trim().max(500, "URL must be 500 characters or fewer."),
    text: z.string().trim().max(5000, "Text must be 5000 characters or fewer."),
  })
  .superRefine((value, ctx) => {
    if (!value.url && !value.text) {
      ctx.addIssue({
        code: "custom",
        message: "Add a URL, some text, or both.",
        path: ["url"],
      });
    }
    if (value.url && !isSafeHttpUrl(value.url)) {
      ctx.addIssue({
        code: "custom",
        message: "URL must start with http:// or https://.",
        path: ["url"],
      });
    }
  });

export const commentSchema = z.object({
  postId: z.string().trim().min(1, "Missing post.").max(64),
  parentId: z.string().trim().max(64).optional().or(z.literal("")),
  text: z.string().trim().min(1, "Comment text is required.").max(4000, "Comment must be 4000 characters or fewer."),
});

export function fieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

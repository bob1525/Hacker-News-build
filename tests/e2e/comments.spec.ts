import { expect, test } from "@playwright/test";
import { DEEP_COMMENT_SNIPPET, DEEP_THREAD_TITLE } from "../../prisma/seed-data";
import { login } from "./helpers";

test("shows a seeded thread nested four levels deep", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("reading papers")}`);
  await page.getByRole("link", { name: DEEP_THREAD_TITLE }).click();
  const root = page.getByTestId("comment").filter({ hasText: "plain text file per paper" });
  await expect(root.getByText(DEEP_COMMENT_SNIPPET)).toBeVisible();
});

test("posts a comment and a nested reply", async ({ page }) => {
  await login(page, "demo");
  await page.goto("/newest");
  await page.getByRole("link", { name: /^\d+ comments?$/ }).first().click();

  const top = `Top-level note ${Date.now()}`;
  const reply = `Nested reply ${Date.now()}`;
  await page.getByRole("textbox", { name: "Comment" }).fill(top);
  await page.getByRole("button", { name: "add comment" }).click();
  const comment = page.getByTestId("comment").filter({ hasText: top });
  await expect(comment).toBeVisible();

  await comment.getByRole("button", { name: "reply", exact: true }).click();
  await comment.getByRole("textbox", { name: "Comment" }).fill(reply);
  await comment.getByRole("button", { name: "post reply" }).click();
  await expect(comment.getByText(reply)).toBeVisible();
});

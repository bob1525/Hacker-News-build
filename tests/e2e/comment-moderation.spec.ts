import { expect, test } from "@playwright/test";
import { DEEP_COMMENT_SNIPPET, DEEP_THREAD_TITLE } from "../../prisma/seed-data";
import { login } from "./helpers";

test("edits and soft-deletes a fresh comment", async ({ page }) => {
  await login(page, "demo");
  await page.goto("/newest");
  await page.getByRole("link", { name: /^\d+ comments?$/ }).first().click();

  const original = `Editable note ${Date.now()}`;
  const revised = `Revised note ${Date.now()}`;
  await page.getByRole("textbox", { name: "Comment" }).fill(original);
  await page.getByRole("button", { name: "add comment" }).click();
  const comment = page.getByTestId("comment").filter({ hasText: original });
  await expect(comment).toBeVisible();

  await comment.getByRole("button", { name: "edit", exact: true }).click();
  await comment.getByRole("textbox", { name: "Edit comment" }).fill(revised);
  await comment.getByRole("button", { name: "save" }).click();
  await expect(page.getByText(revised)).toBeVisible();
  await expect(page.getByText("edited").first()).toBeVisible();
  await expect(page.getByText(original)).toHaveCount(0);

  await page.getByTestId("comment").filter({ hasText: revised }).getByRole("button", { name: "delete", exact: true }).click();
  await expect(page.getByText("已删除")).toBeVisible();
  await expect(page.getByText(revised)).toHaveCount(0);
  await expect(page.locator("[data-deleted='true']").first()).toBeVisible();
});

test("does not offer edit or delete on someone else's comment", async ({ page }) => {
  await login(page, "demo");
  await page.goto(`/search?q=${encodeURIComponent("reading papers")}`);
  await page.getByRole("link", { name: DEEP_THREAD_TITLE }).click();
  const comment = page.getByTestId("comment").filter({ hasText: DEEP_COMMENT_SNIPPET }).last();
  await expect(comment.getByRole("button", { name: "edit", exact: true })).toHaveCount(0);
  await expect(comment.getByRole("button", { name: "delete", exact: true })).toHaveCount(0);
});

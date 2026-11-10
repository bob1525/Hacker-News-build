import { expect, test } from "@playwright/test";
import { DEEP_COMMENT_SNIPPET, DEEP_THREAD_TITLE } from "../../prisma/seed-data";

test("keeps a collapsed comment collapsed after reload and navigation", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("reading papers")}`);
  await page.getByRole("link", { name: DEEP_THREAD_TITLE }).click();
  await expect(page.getByText(DEEP_COMMENT_SNIPPET)).toBeVisible();

  const root = page.getByTestId("comment").filter({ hasText: "plain text file per paper" }).first();
  await root.getByRole("button", { name: "Collapse comment" }).first().click();
  await expect(page.getByText(DEEP_COMMENT_SNIPPET)).toBeHidden();

  await page.reload();
  await expect(page.getByText(DEEP_COMMENT_SNIPPET)).toBeHidden();

  const itemUrl = page.url();
  await page.goto("/newest");
  await page.goto(itemUrl);
  await expect(page.getByText(DEEP_COMMENT_SNIPPET)).toBeHidden();

  await page.getByRole("button", { name: "Expand comment" }).first().click();
  await expect(page.getByText(DEEP_COMMENT_SNIPPET)).toBeVisible();
  await page.reload();
  await expect(page.getByText(DEEP_COMMENT_SNIPPET)).toBeVisible();
});

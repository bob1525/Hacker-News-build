import { expect, test } from "@playwright/test";
import { NEWEST_POST_TITLE } from "../../prisma/seed-data";
import { login, readPoints } from "./helpers";

test("toggles a downvote and restores the previous score", async ({ page }) => {
  await login(page, "patio11");
  await page.goto("/newest");
  const row = page.getByRole("listitem").filter({ hasText: NEWEST_POST_TITLE });
  await row.getByRole("link", { name: /^\d+ comments?$/ }).click();

  const header = page.getByTestId("post-header");
  const points = header.getByTestId("post-points");
  const before = readPoints(await points.innerText());
  const button = header.getByRole("button", { name: /^(Downvote|Remove downvote)$/ });
  await button.click();
  await expect.poll(async () => readPoints(await points.innerText())).toBe(before - 1);

  await button.click();
  await expect.poll(async () => readPoints(await points.innerText())).toBe(before);
});

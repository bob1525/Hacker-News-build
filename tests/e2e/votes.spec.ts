import { expect, test } from "@playwright/test";
import { HOT_POST_TITLE } from "../../prisma/seed-data";
import { login, readPoints } from "./helpers";

test("toggles an upvote and restores the previous score", async ({ page }) => {
  await login(page, "demo");
  await page.goto("/");
  await expect(page.getByTestId("post-title").first()).toHaveText(HOT_POST_TITLE);
  await page.getByRole("link", { name: /^\d+ comments?$/ }).first().click();

  const header = page.getByTestId("post-header");
  const points = header.getByTestId("post-points");
  const before = readPoints(await points.innerText());
  const button = header.getByRole("button");
  await button.click();
  await expect.poll(async () => readPoints(await points.innerText())).not.toBe(before);
  const mid = readPoints(await points.innerText());
  expect(Math.abs(mid - before)).toBe(1);

  await button.click();
  await expect.poll(async () => readPoints(await points.innerText())).toBe(before);
});

test("does not offer a vote on your own post", async ({ page }) => {
  await login(page, "rvn");
  await page.goto("/");
  await page.getByRole("link", { name: /^\d+ comments?$/ }).first().click();
  await expect(page.getByTestId("post-header").getByRole("button")).toHaveCount(0);
  await expect(page.getByText("by rvn")).toBeVisible();
});

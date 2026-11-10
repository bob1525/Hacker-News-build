import { expect, test } from "@playwright/test";
import { DEEP_COMMENT_SNIPPET, DEEP_THREAD_TITLE } from "../../prisma/seed-data";
import { login, readPoints } from "./helpers";

test("toggles a comment vote and restores the score", async ({ page }) => {
  await login(page, "demo");
  await page.goto(`/search?q=${encodeURIComponent("reading papers")}`);
  await page.getByRole("link", { name: DEEP_THREAD_TITLE }).click();

  const comment = page.getByTestId("comment").filter({ hasText: DEEP_COMMENT_SNIPPET }).last();
  const points = comment.getByTestId("comment-points");
  const before = readPoints(await points.innerText());
  const button = comment.getByRole("button", { name: /^(Upvote|Unvote)$/ });
  const firstVote = page.waitForResponse((response) => response.request().method() === "POST");
  await button.click();
  await firstVote;
  await expect.poll(async () => readPoints(await points.innerText())).not.toBe(before);
  const mid = readPoints(await points.innerText());
  expect(Math.abs(mid - before)).toBe(1);

  const secondVote = page.waitForResponse((response) => response.request().method() === "POST");
  await button.click();
  await secondVote;
  await expect.poll(async () => readPoints(await points.innerText())).toBe(before);
});

test("comment votes change the author's karma and unvoting restores it", async ({ page }) => {
  await login(page, "demo");
  await page.goto("/user/dang");
  const beforeKarma = Number(await page.getByTestId("karma").innerText());

  await page.goto(`/search?q=${encodeURIComponent("reading papers")}`);
  await page.getByRole("link", { name: DEEP_THREAD_TITLE }).click();
  const comment = page.getByTestId("comment").filter({ hasText: DEEP_COMMENT_SNIPPET }).last();
  const button = comment.getByRole("button", { name: /^(Upvote|Unvote)$/ });
  const wasVoted = (await button.getAttribute("aria-pressed")) === "true";
  const delta = wasVoted ? -1 : 1;
  const firstVote = page.waitForResponse((response) => response.request().method() === "POST");
  await button.click();
  await firstVote;

  await page.goto("/user/dang");
  await expect(page.getByTestId("karma")).toHaveText(String(beforeKarma + delta));

  await page.goto(`/search?q=${encodeURIComponent("reading papers")}`);
  await page.getByRole("link", { name: DEEP_THREAD_TITLE }).click();
  const again = page.getByTestId("comment").filter({ hasText: DEEP_COMMENT_SNIPPET }).last();
  const restore = page.waitForResponse((response) => response.request().method() === "POST");
  await again.getByRole("button", { name: /^(Upvote|Unvote)$/ }).click();
  await restore;
  await page.goto("/user/dang");
  await expect(page.getByTestId("karma")).toHaveText(String(beforeKarma));
});

import { expect, test } from "@playwright/test";

test("shows karma, posts, and comments on a profile", async ({ page }) => {
  await page.goto("/user/pg");
  await expect(page.getByText("I helped start Y Combinator. I still read the comments.")).toBeVisible();
  const karma = Number(await page.getByTestId("karma").innerText());
  expect(karma).toBeGreaterThan(0);
  await expect(page.getByRole("heading", { name: "posts" })).toBeVisible();
  await expect(page.getByTestId("post-title").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "comments" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^on:/ }).first()).toBeVisible();
});

test("shows empty states and a missing profile", async ({ page }) => {
  await page.goto("/user/lurker");
  await expect(page.getByTestId("karma")).toHaveText("0");
  await expect(page.getByText("No posts yet.")).toBeVisible();
  await expect(page.getByText("No comments yet.")).toBeVisible();

  await page.goto("/user/does-not-exist");
  await expect(page.getByText("No such page.")).toBeVisible();
});

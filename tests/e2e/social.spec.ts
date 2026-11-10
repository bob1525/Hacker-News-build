import { expect, test } from "@playwright/test";
import { HOT_POST_TITLE } from "../../prisma/seed-data";
import { login } from "./helpers";

async function clickAndWait(page: import("@playwright/test").Page, name: "favorite" | "unfavorite" | "follow" | "unfollow") {
  const response = page.waitForResponse((entry) => entry.request().method() === "POST");
  await page.getByRole("button", { name, exact: true }).click();
  await response;
}

test("saves a story on the profile and removes it", async ({ page }) => {
  await login(page, "demo");
  await page.goto("/");
  await expect(page.getByTestId("post-title").first()).toHaveText(HOT_POST_TITLE);
  await page.getByRole("link", { name: /^\d+ comments?$/ }).first().click();
  await clickAndWait(page, "favorite");
  await expect(page.getByRole("button", { name: "unfavorite", exact: true })).toBeVisible();

  await page.goto("/user/demo");
  await expect(page.getByRole("heading", { name: "favorites" })).toBeVisible();
  await expect(page.getByRole("link", { name: HOT_POST_TITLE })).toBeVisible();
  await clickAndWait(page, "unfavorite");
  await page.reload();
  await expect(page.getByText("No favorites yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: HOT_POST_TITLE })).toHaveCount(0);
});

test("follow and unfollow update both counts", async ({ page }) => {
  await login(page, "demo");
  await page.goto("/user/demo");
  const followingBefore = Number(await page.getByTestId("following-count").innerText());

  await page.goto("/user/pg");
  const followersBefore = Number(await page.getByTestId("follower-count").innerText());
  await clickAndWait(page, "follow");
  await page.reload();
  await expect(page.getByTestId("follower-count")).toHaveText(String(followersBefore + 1));
  await expect(page.getByRole("button", { name: "unfollow", exact: true })).toBeVisible();

  await page.goto("/user/demo");
  await expect(page.getByTestId("following-count")).toHaveText(String(followingBefore + 1));
  await expect(page.getByRole("button", { name: /^(follow|unfollow)$/ })).toHaveCount(0);

  await page.goto("/following");
  await expect(page.getByRole("link", { name: "pg" }).first()).toBeVisible();

  await page.goto("/user/pg");
  await clickAndWait(page, "unfollow");
  await page.reload();
  await expect(page.getByTestId("follower-count")).toHaveText(String(followersBefore));
});

test("asks logged-out visitors to log in before the following feed", async ({ page }) => {
  await page.goto("/following");
  await expect(page.getByText("Log in to see stories from people you follow.")).toBeVisible();
});

test("shows an empty following feed before you follow anyone", async ({ page }) => {
  await login(page, "lurker");
  await page.goto("/following");
  await expect(page.getByText("You are not following anyone yet.")).toBeVisible();
});

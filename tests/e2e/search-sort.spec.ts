import { expect, test } from "@playwright/test";
import { HOT_POST_TITLE, NEWEST_POST_TITLE } from "../../prisma/seed-data";

test("ranks the front page by heat and the new page by time", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("post-title").first()).toHaveText(HOT_POST_TITLE);

  await page.goto("/newest");
  const titles = await page.getByTestId("post-title").allTextContents();
  const newest = titles.indexOf(NEWEST_POST_TITLE);
  const hot = titles.indexOf(HOT_POST_TITLE);
  expect(newest).toBeGreaterThanOrEqual(0);
  expect(hot).toBeGreaterThan(newest);

  await page.getByRole("link", { name: "More" }).click();
  await expect(page).toHaveURL(/[?&]p=2/);
  await expect(page.getByTestId("post-title").first()).toBeVisible();
  await expect(page.getByTestId("post-title").first()).not.toHaveText(HOT_POST_TITLE);
});

test("searches titles, shows an empty query, and an empty result", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByText("Search stories")).toBeVisible();

  await page.getByLabel("Search posts").fill("ferrocene");
  await page.getByRole("button", { name: "search" }).click();
  await expect(page.getByTestId("post-title")).toHaveCount(1);
  await expect(page.getByTestId("post-title")).toHaveText(/Ferrocene/);

  await page.goto("/search?q=zzzz-not-a-real-story");
  await expect(page.getByText(/No posts matched/)).toBeVisible();
});

test("filters ask and show pages", async ({ page }) => {
  await page.goto("/ask");
  const askKinds = await page.locator("li[data-kind]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-kind")));
  expect(askKinds.length).toBeGreaterThan(0);
  expect(askKinds.every((kind) => kind === "text")).toBe(true);

  await page.goto("/show");
  const showTitles = await page.getByTestId("post-title").allTextContents();
  expect(showTitles.length).toBeGreaterThan(1);
  expect(showTitles.every((title) => title.startsWith("Show HN:"))).toBe(true);
});

import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseURL = process.env.SCREENSHOT_BASE_URL ?? "http://127.0.0.1:3000";
const outDir = "docs/screenshots";

async function shot(page, name) {
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`wrote ${outDir}/${name}.png`);
}

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });

await mkdir(outDir, { recursive: true });

await page.goto(`${baseURL}/`);
await page.getByTestId("post-title").first().waitFor();
await shot(page, "home");

await page.goto(`${baseURL}/login`);
await page.getByRole("button", { name: "login" }).waitFor();
await shot(page, "login");

await page.getByLabel("Username").fill("demo");
await page.getByLabel("Password").fill("news12345");
await page.getByRole("button", { name: "login" }).click();
await page.getByTestId("current-user").waitFor();
await page.goto(`${baseURL}/submit`);
await page.getByLabel("Title").waitFor();
await page.getByLabel("Title").fill("Show HN: A quieter log viewer");
await page.getByLabel("URL").fill("https://example.com/log-viewer");
await page.getByLabel("Text").fill("Single binary, no account. Looking for feedback before I add accounts.");
await page.getByRole("heading", { name: "Submit" }).click();
await shot(page, "submit");

await page.goto(`${baseURL}/search?q=ferrocene`);
await page.getByText(/result/).waitFor();
await shot(page, "search");

await page.goto(`${baseURL}/user/pg`);
await page.getByTestId("karma").waitFor();
await shot(page, "user-profile");

await page.goto(`${baseURL}/search?q=${encodeURIComponent("reading papers")}`);
await page.getByRole("link", { name: "Ask HN: How do you take notes while reading papers?" }).click();
await page.getByText("Indentation is a feature, infinite folders are not.").scrollIntoViewIfNeeded();
await shot(page, "item-comments");

await page.goto(`${baseURL}/`);
await page.getByTestId("post-title").first().waitFor();
const favoriteTitle = (await page.getByTestId("post-title").first().innerText()).trim();
await page.getByRole("link", { name: /^\d+ comments?$/ }).first().click();
const favoriteToggle = page.getByRole("button", { name: /^(favorite|unfavorite)$/ }).first();
await favoriteToggle.waitFor();
if ((await favoriteToggle.innerText()) === "favorite") {
  const favoriteResponse = page.waitForResponse((entry) => entry.request().method() === "POST");
  await favoriteToggle.click();
  await favoriteResponse;
}
await page.getByRole("button", { name: "unfavorite", exact: true }).first().waitFor();
await page.goto(`${baseURL}/user/demo`);
await page.getByRole("heading", { name: "favorites" }).waitFor();
await page.getByRole("link", { name: favoriteTitle }).waitFor();
await shot(page, "profile-favorites");

await page.goto(`${baseURL}/user/pg`);
await page.getByTestId("follower-count").waitFor();
const followToggle = page.getByRole("button", { name: /^(follow|unfollow)$/ }).first();
await followToggle.waitFor();
if ((await followToggle.innerText()) === "follow") {
  const followResponse = page.waitForResponse((entry) => entry.request().method() === "POST");
  await followToggle.click();
  await followResponse;
}
await page.getByRole("button", { name: "unfollow", exact: true }).waitFor();
await page.waitForFunction(() => {
  const count = document.querySelector("[data-testid='follower-count']");
  return Boolean(count && count.textContent.trim() !== "0");
});
await page.getByTestId("following-count").waitFor();
await shot(page, "profile-following-count");

await page.goto(`${baseURL}/following`);
await page.getByText("Stories from people you follow").waitFor();
await page.getByRole("link", { name: "pg" }).first().waitFor();
await shot(page, "following-page");

await page.goto(`${baseURL}/search?q=${encodeURIComponent("reading papers")}`);
await page.getByRole("link", { name: "Ask HN: How do you take notes while reading papers?" }).click();
const votedComment = page
  .getByTestId("comment")
  .filter({ hasText: "Indentation is a feature, infinite folders are not." })
  .last();
const voteButton = votedComment.getByRole("button", { name: /^(Upvote|Unvote)$/ });
if ((await voteButton.getAttribute("aria-pressed")) !== "true") {
  const voteResponse = page.waitForResponse((entry) => entry.request().method() === "POST");
  await voteButton.click();
  await voteResponse;
}
await votedComment.getByRole("button", { name: "Unvote" }).waitFor();
await votedComment.screenshot({ path: `${outDir}/comment-vote.png` });
console.log(`wrote ${outDir}/comment-vote.png`);

const deleteText = `Delete me for the screenshot ${Date.now()}`;
await page.getByRole("textbox", { name: "Comment" }).fill(deleteText);
await page.getByRole("button", { name: "add comment" }).click();
const freshComment = page.getByTestId("comment").filter({ hasText: deleteText });
await freshComment.waitFor();
await freshComment.getByRole("button", { name: "delete", exact: true }).click();
await page.getByText(deleteText).waitFor({ state: "hidden" });
const deletedComment = page.locator("[data-testid='comment'][data-deleted='true']").filter({ hasText: "已删除" }).first();
await deletedComment.waitFor();
await page.waitForLoadState("load");
await deletedComment.screenshot({ path: `${outDir}/comment-deleted.png` });
console.log(`wrote ${outDir}/comment-deleted.png`);

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto(`${baseURL}/`);
await mobile.getByTestId("post-title").first().waitFor();
await mobile.screenshot({ path: `${outDir}/home-mobile.png` });
console.log(`wrote ${outDir}/home-mobile.png`);

await browser.close();

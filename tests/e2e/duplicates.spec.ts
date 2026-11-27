import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("rejects a second post whose title matches a recent one", async ({ page }) => {
  await login(page, "nash");
  const title = `Duplicate probe ${Date.now()}`;
  await page.goto("/submit");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Text").fill("First copy of the probe.");
  await page.getByRole("button", { name: "submit" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.goto("/submit");
  await page.getByLabel("Title").fill(`${title}!`);
  await page.getByLabel("Text").fill("A second copy with different body text.");
  await page.getByRole("button", { name: "submit" }).click();
  await expect(page.getByText("You recently submitted a very similar post.")).toBeVisible();
});

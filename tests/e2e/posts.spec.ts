import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("asks visitors to log in before submitting", async ({ page }) => {
  await page.goto("/submit");
  await expect(page.getByText("Log in to submit a story.")).toBeVisible();
  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("submits a text post and a link post", async ({ page }) => {
  await login(page, "demo");
  const textTitle = `E2E text ${Date.now()}`;
  await page.goto("/submit");
  await page.getByRole("button", { name: "submit" }).click();
  await expect(page.getByText("Title is required.")).toBeVisible();

  await page.getByLabel("Title").fill(textTitle);
  await page.getByLabel("Text").fill("Hello from the end-to-end suite.");
  await page.getByRole("button", { name: "submit" }).click();
  await expect(page.getByRole("heading", { name: textTitle })).toBeVisible();
  await expect(page.getByText("Hello from the end-to-end suite.")).toBeVisible();

  await page.goto("/newest");
  await expect(page.getByTestId("post-title").first()).toHaveText(textTitle);

  const linkTitle = `E2E link ${Date.now()}`;
  await page.goto("/submit");
  await page.getByLabel("Title").fill(linkTitle);
  await page.getByLabel("URL").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "submit" }).click();
  await expect(page.getByText("URL must start with http:// or https://.")).toBeVisible();

  await page.getByLabel("URL").fill("https://example.com/e2e-story");
  await page.getByRole("button", { name: "submit" }).click();
  await expect(page.getByRole("heading", { name: linkTitle })).toBeVisible();
  await expect(page.getByRole("link", { name: linkTitle })).toHaveAttribute("href", "https://example.com/e2e-story");
  await expect(page.getByText("(example.com)")).toBeVisible();
});

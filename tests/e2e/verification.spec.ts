import { expect, test } from "@playwright/test";

test("keeps a new account signed in and lets them resend the verification email", async ({ page }) => {
  const username = `v${Date.now().toString(36)}`;
  await page.goto("/register");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(`${username}@example.com`);
  await page.getByLabel("Password").fill("supersecret");
  await page.getByRole("button", { name: "create account" }).click();
  await expect(page.getByTestId("current-user")).toHaveText(username);

  await page.goto("/verify");
  await expect(page.getByText("Open the verification link from your email.")).toBeVisible();
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(page.getByText("Verification email sent.")).toBeVisible();
});

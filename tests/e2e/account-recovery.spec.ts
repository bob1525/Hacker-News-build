import { expect, test } from "@playwright/test";
import { clearMailLog, latestToken, mailboxMark } from "./mail-log";

test("shows an invalid password-reset or email-change link", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByText("That reset link is not valid.")).toBeVisible();
  await page.goto("/reset-password?token=short");
  await expect(page.getByText("That reset link is not valid.")).toBeVisible();
  await page.goto("/change-email");
  await expect(page.getByText("That confirmation link is not valid.")).toBeVisible();
  await page.goto("/forgot-password");
  await expect(page.getByRole("button", { name: "send reset link" })).toBeVisible();
});

test("resets a password from the emailed link and rejects the old one", async ({ page }) => {
  const username = `p${Date.now().toString(36)}`;
  const email = `${username}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("supersecret");
  await page.getByRole("button", { name: "create account" }).click();
  await expect(page.getByTestId("current-user")).toHaveText(username);
  await page.getByRole("button", { name: "logout" }).click();
  await expect(page.getByRole("link", { name: "login" })).toBeVisible();

  clearMailLog();
  const resetMark = mailboxMark();
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "send reset link" }).click();
  await expect(page.getByText("If that account exists, a reset link was sent.")).toBeVisible();
  const token = await latestToken("Reset your password", resetMark);

  await page.goto(`/reset-password?token=${encodeURIComponent(token)}`);
  await page.getByLabel("New password").fill("reset-secret-1");
  await page.getByRole("button", { name: "update password" }).click();
  await expect(page.getByText("Password updated. Log in with the new one.")).toBeVisible();

  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("reset-secret-1");
  await page.getByRole("button", { name: "login" }).click();
  await expect(page.getByTestId("current-user")).toHaveText(username);
  await page.getByRole("button", { name: "logout" }).click();
  await expect(page.getByRole("link", { name: "login" })).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("supersecret");
  await page.getByRole("button", { name: "login" }).click();
  await expect(page.getByText("Invalid username or password.")).toBeVisible();
  await expect(page.getByTestId("current-user")).toHaveCount(0);
});

test("keeps the old email until the change link is confirmed", async ({ page }) => {
  const username = `e${Date.now().toString(36)}`;
  const email = `${username}@example.com`;
  const nextEmail = `${username}-next@example.com`;
  await page.goto("/register");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("supersecret");
  await page.getByRole("button", { name: "create account" }).click();
  await expect(page.getByTestId("current-user")).toHaveText(username);

  clearMailLog();
  const changeMark = mailboxMark();
  await page.goto(`/user/${username}`);
  await expect(page.getByTestId("account-email")).toHaveText(email);
  await page.getByLabel("New email").fill(nextEmail);
  await page.getByRole("button", { name: "send confirmation" }).click();
  await expect(page.getByText("Check the new inbox for a confirmation link.")).toBeVisible();
  await expect(page.getByTestId("account-email")).toHaveText(email);

  const token = await latestToken("Confirm your new email", changeMark);
  await page.goto(`/change-email?token=${encodeURIComponent(token)}`);
  await page.getByRole("button", { name: "confirm new email" }).click();
  await expect(page.getByTestId("account-email")).toHaveText(nextEmail);
  await expect(page.getByTestId("current-user")).toHaveText(username);
});

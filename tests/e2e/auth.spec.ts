import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD } from "../../lib/config";

test("registers, rejects a bad password, and logs in", async ({ page }) => {
  const username = `u${Date.now().toString().slice(-8)}`;
  await page.goto("/register");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(`${username}@example.com`);
  await page.getByLabel("Password").fill("supersecret");
  await page.getByRole("button", { name: "create account" }).click();
  await expect(page.getByTestId("current-user")).toHaveText(username);

  await page.getByRole("button", { name: "logout" }).click();
  await expect(page.getByRole("link", { name: "login" })).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "login" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Invalid username or password.");

  await page.getByLabel("Password").fill("supersecret");
  await page.getByRole("button", { name: "login" }).click();
  await expect(page.getByTestId("current-user")).toHaveText(username);
});

test("shows validation errors and rejects a taken username", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Username").fill("a");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "create account" }).click();
  await expect(page.getByText("Username must be at least 2 characters.")).toBeVisible();
  await expect(page.getByText("Enter a valid email.")).toBeVisible();
  await expect(page.getByText("Password must be at least 8 characters.")).toBeVisible();

  await page.getByLabel("Username").fill("pg");
  await page.getByLabel("Email").fill("brand-new-pg@example.com");
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "create account" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("That username is taken.");
});

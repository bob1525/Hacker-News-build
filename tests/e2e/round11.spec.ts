import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { clearMailLog, latestServerBlock, latestToken, mailLogPath, serverLogMark } from "./mail-log";

test("signs out other devices and keeps this browser", async ({ browser }) => {
  const username = `o${Date.now().toString(36)}`;
  const email = `${username}@example.com`;
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.goto("/register");
  await pageA.getByLabel("Username").fill(username);
  await pageA.getByLabel("Email").fill(email);
  await pageA.getByLabel("Password").fill("supersecret");
  await pageA.getByRole("button", { name: "create account" }).click();
  await expect(pageA.getByTestId("current-user")).toHaveText(username);

  await pageB.goto("/login");
  await pageB.getByLabel("Username").fill(username);
  await pageB.getByLabel("Password").fill("supersecret");
  await pageB.getByRole("button", { name: "login" }).click();
  await expect(pageB.getByTestId("current-user")).toHaveText(username);

  await pageA.goto(`/user/${username}`);
  await pageA.getByRole("button", { name: "Sign out other devices" }).click();
  await expect(pageA.getByText("Other devices were signed out. This browser stays signed in.")).toBeVisible();
  await expect(pageA.getByTestId("current-user")).toHaveText(username);
  await pageA.goto("/");
  await expect(pageA.getByTestId("current-user")).toHaveText(username);

  await pageB.goto("/");
  await expect(pageB.getByRole("link", { name: "login" })).toBeVisible();
  await expect(pageB.getByTestId("current-user")).toHaveCount(0);
  await pageB.goto(`/user/${username}`);
  await expect(pageB.getByRole("button", { name: "Sign out other devices" })).toHaveCount(0);

  await contextA.close();
  await contextB.close();
});

test("notifies the old address without a token and keeps the production mail log free of tokens", async ({ page }) => {
  const username = `n${Date.now().toString(36)}`;
  const email = `${username}@example.com`;
  const nextEmail = `${username}-next@example.com`;
  await page.goto("/register");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("supersecret");
  await page.getByRole("button", { name: "create account" }).click();
  await expect(page.getByTestId("current-user")).toHaveText(username);

  clearMailLog();
  const changeMark = serverLogMark();
  await page.goto(`/user/${username}`);
  await page.getByLabel("New email").fill(nextEmail);
  await page.getByRole("button", { name: "send confirmation" }).click();
  await expect(page.getByText("Check the new inbox for a confirmation link.")).toBeVisible();
  await expect(page.getByTestId("account-email")).toHaveText(email);

  const requested = await latestServerBlock("Email change requested", changeMark);
  expect(requested).toContain(`to=${email}`);
  expect(requested).not.toContain("token=");
  expect(requested).not.toContain("/change-email");
  const confirmation = await latestServerBlock("Confirm your new email", changeMark);
  expect(confirmation).toContain(`to=${nextEmail}`);
  expect(confirmation).toContain("token=");

  const logged = readFileSync(mailLogPath, "utf8");
  expect(logged).toContain(email);
  expect(logged).toContain("Email change requested");
  expect(logged).toContain("[body omitted]");
  expect(logged).not.toContain("token=");
  expect(logged).not.toContain("/change-email");

  const token = await latestToken("Confirm your new email", changeMark);
  await page.goto(`/change-email?token=${encodeURIComponent(token)}`);
  await page.getByRole("button", { name: "confirm new email" }).click();
  await expect(page.getByTestId("account-email")).toHaveText(nextEmail);
  await expect(page.getByTestId("current-user")).toHaveText(username);

  const changed = await latestServerBlock("Your email was changed", changeMark);
  expect(changed).toContain(`to=${email}`);
  expect(changed).not.toContain("token=");
  expect(changed).not.toContain("/change-email");
  expect(readFileSync(mailLogPath, "utf8")).not.toContain("token=");
});

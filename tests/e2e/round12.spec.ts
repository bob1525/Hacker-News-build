import { expect, test } from "@playwright/test";
import { DEEP_COMMENT_SNIPPET, DEEP_THREAD_TITLE } from "../../prisma/seed-data";

test("revokes one device and leaves this browser signed in", async ({ browser }) => {
  const username = `d${Date.now().toString(36)}`;
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

  await pageA.goto(`/user/${username}`);
  await expect(pageA.getByTestId("device-row")).toHaveCount(1);
  await expect(pageA.locator("[data-testid='device-row'][data-current='true']")).toHaveCount(1);

  await pageB.goto("/login");
  await pageB.getByLabel("Username").fill(username);
  await pageB.getByLabel("Password").fill("supersecret");
  await pageB.getByRole("button", { name: "login" }).click();
  await expect(pageB.getByTestId("current-user")).toHaveText(username);

  await pageA.goto(`/user/${username}`);
  await expect(pageA.getByTestId("device-row")).toHaveCount(2);
  const other = pageA.locator("[data-testid='device-row'][data-current='false']");
  await other.getByRole("button", { name: "Sign out this device" }).click();
  await expect(pageA.getByText("That device was signed out.")).toBeVisible();
  await expect(pageA.getByTestId("current-user")).toHaveText(username);
  await expect(pageA.locator("[data-testid='device-row'][data-current='true']")).toHaveCount(1);

  await pageB.goto("/");
  await expect(pageB.getByRole("link", { name: "login" })).toBeVisible();
  await expect(pageB.getByTestId("current-user")).toHaveCount(0);

  await contextA.close();
  await contextB.close();
});

test("keeps a guest collapse after the visitor logs in", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("reading papers")}`);
  await page.getByRole("link", { name: DEEP_THREAD_TITLE }).click();
  await expect(page.getByText(DEEP_COMMENT_SNIPPET)).toBeVisible();
  const itemUrl = page.url();

  const root = page.getByTestId("comment").filter({ hasText: "plain text file per paper" }).first();
  await root.getByRole("button", { name: "Collapse comment" }).first().click();
  await expect(page.getByText(DEEP_COMMENT_SNIPPET)).toBeHidden();

  const username = `c${Date.now().toString(36)}`;
  await page.goto("/register");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(`${username}@example.com`);
  await page.getByLabel("Password").fill("supersecret");
  await page.getByRole("button", { name: "create account" }).click();
  await expect(page.getByTestId("current-user")).toHaveText(username);

  await expect
    .poll(async () => {
      await page.goto(itemUrl);
      if ((await page.getByRole("heading", { name: /\d+ comments/ }).count()) === 0) return "missing";
      const hidden = await page.getByText(DEEP_COMMENT_SNIPPET).isHidden();
      const expanded = await page.getByRole("button", { name: "Expand comment" }).count();
      return hidden && expanded > 0 ? "collapsed" : "open";
    })
    .toBe("collapsed");
});

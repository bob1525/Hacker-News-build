import { expect, type Page } from "@playwright/test";
import { DEMO_PASSWORD } from "../../lib/config";

export async function login(page: Page, username: string, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "login" }).click();
  await expect(page.getByTestId("current-user")).toHaveText(username);
}

export function readPoints(text: string): number {
  const match = text.trim().match(/^(\d+)/);
  if (!match) throw new Error(`Could not read points from “${text}”`);
  return Number(match[1]);
}

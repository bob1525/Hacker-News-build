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

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto(`${baseURL}/`);
await mobile.getByTestId("post-title").first().waitFor();
await mobile.screenshot({ path: `${outDir}/home-mobile.png` });
console.log(`wrote ${outDir}/home-mobile.png`);

await browser.close();

import { expect, test } from "@playwright/test";
import { NEWEST_POST_TITLE } from "../../prisma/seed-data";
import { login } from "./helpers";

const lines = [
  "Quartz clocks drift beside the river map.",
  "Bicycles need oil on the chain this week.",
  "Penguins cannot host a banquet in July.",
  "Violet ink stained the ledger of accounts.",
  "Hammers bounce off frozen copper pipes.",
  "Oranges rot faster inside a linen sack.",
  "Kites tangle above the empty stadium.",
  "Wolves ignore the printed timetable.",
  "Spoons conduct heat through tomato soup.",
  "Yachts anchor far from the wheat field.",
  "Drums echo under the concrete bridge.",
  "Falcons circle the quiet greenhouse.",
];

test("marks comment depths 11 and up without indenting past 120px", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, "demo");
  await page.goto("/newest");
  const row = page.getByRole("listitem").filter({ hasText: NEWEST_POST_TITLE });
  await row.getByRole("link", { name: /^\d+ comments?$/ }).click();

  let text = lines[0]!;
  await page.getByRole("textbox", { name: "Comment" }).first().fill(text);
  await page.getByRole("button", { name: "add comment" }).click();
  await expect(page.getByRole("paragraph").filter({ hasText: text })).toBeVisible();

  for (let depth = 1; depth <= 11; depth += 1) {
    const parent = page.getByTestId("comment").filter({ hasText: text }).last();
    await parent.getByRole("button", { name: "reply", exact: true }).click();
    text = lines[depth]!;
    await parent.getByRole("textbox", { name: "Comment" }).fill(text);
    await parent.getByRole("button", { name: "post reply" }).click();
    await expect(page.getByRole("paragraph").filter({ hasText: text })).toBeVisible();
  }

  const marked = page.getByTestId("comment").filter({ hasText: text }).last();
  await expect(marked.locator("> div > div").first().getByTestId("comment-depth-mark")).toHaveText("11");
  await expect(marked).toHaveCSS("margin-left", "0px");
  await expect(marked.locator("> div").first()).toHaveAttribute("data-comment-gutter", "false");

  const capped = page.getByTestId("comment").filter({ hasText: lines[10]! }).last();
  await expect(capped.locator("> div > div").first().getByTestId("comment-depth-mark")).toHaveCount(0);
  await expect(capped).toHaveCSS("margin-left", "12px");
  await expect(capped.locator("> div").first()).toHaveAttribute("data-comment-gutter", "true");
});

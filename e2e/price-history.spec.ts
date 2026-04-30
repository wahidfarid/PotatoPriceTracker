import { test, expect } from "@playwright/test";

test.describe("price history modal", () => {
  test("modal opens when a sparkline is clicked", async ({ page }) => {
    await page.goto("/");

    // Wait for the card list to render
    await page.waitForSelector('[class*="pt-24"], [class*="pt-28"]');

    // Sparklines render as inline-block divs with a border — both the empty
    // placeholder and the real SVG chart are wrapped in the same container div.
    // title attribute values come from i18n: "sparklineClick" or "sparklineEmpty".
    const sparkline = page
      .locator("div[title]")
      .filter({ hasText: /^-$/ })
      .or(page.locator("div > svg").locator(".."))
      .first();

    // Broader fallback: any clickable inline-block div inside a table cell
    const anySparkline = page
      .locator("td div.inline-block.cursor-pointer")
      .first();

    const target = (await sparkline.count()) > 0 ? sparkline : anySparkline;

    await expect(target).toBeVisible({ timeout: 5000 });
    await target.click();

    await expect(page.locator('[role="dialog"]')).toBeVisible({
      timeout: 5000,
    });
  });

  test("modal closes with Escape key", async ({ page }) => {
    await page.goto("/");

    await page.waitForSelector('[class*="pt-24"], [class*="pt-28"]');

    const anySparkline = page
      .locator("td div.inline-block.cursor-pointer")
      .first();

    await expect(anySparkline).toBeVisible({ timeout: 5000 });
    await anySparkline.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.keyboard.press("Escape");

    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});

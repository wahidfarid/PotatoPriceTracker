import { test, expect } from "@playwright/test";

test.describe("price history modal", () => {
  test("modal opens when a sparkline is clicked", async ({ page }) => {
    await page.goto("/");

    // Wait for the card list to render
    await page.waitForSelector('[class*="pt-24"], [class*="pt-28"]');

    // SparklineChart renders as an inline-block cursor-pointer div inside a <td>
    const target = page.locator("td div.inline-block.cursor-pointer").first();

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

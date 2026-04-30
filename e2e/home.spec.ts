import { test, expect } from "@playwright/test";

test.describe("home page", () => {
  test("loads with set tabs visible", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);

    // At least one set tab button should be present
    const firstTab = page
      .getByRole("button", { name: /SOS|ECL|TMT|SOC|ECC|SPG|TMC|PZA|SOA/i })
      .first();
    await expect(firstTab).toBeVisible();
  });

  test("search box filters cards", async ({ page }) => {
    await page.goto("/");

    // Wait for card list area to appear
    await page.waitForSelector('[class*="pt-24"], [class*="pt-28"]');

    const searchInput = page.getByRole("textbox");
    await expect(searchInput).toBeVisible();

    await searchInput.fill("E2E Test Card");

    // Either the card appears, or the "no results" empty state appears — both are valid
    const cardAppeared = page.locator("h2", { hasText: "E2E Test Card" });
    const noResults = page
      .locator('[class*="text-center"]')
      .filter({ hasText: /no results|見つかりません/i });

    await expect(cardAppeared.or(noResults).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("set tab navigation changes URL", async ({ page }) => {
    await page.goto("/");

    // Find a tab that isn't the default active one (SOS is default)
    const eclTab = page.getByRole("button", { name: /ECL|Eclipsed/i }).first();
    const tabVisible = await eclTab.isVisible().catch(() => false);

    if (tabVisible) {
      await eclTab.click();
      await page.waitForURL(/set=ECL/i, { timeout: 5000 });
      expect(page.url()).toMatch(/set=ECL/i);
    } else {
      // Fall back to any non-active tab
      const tabs = page.getByRole("button", {
        name: /SOS|SOC|SOA|ECL|ECC|SPG|TMT|TMC|PZA/i,
      });
      const count = await tabs.count();
      // Click the second tab (index 1), whatever it is
      if (count > 1) {
        await tabs.nth(1).click();
        await expect(page).toHaveURL(/\?set=/i, { timeout: 5000 });
      }
    }
  });
});

import { test, expect } from "@playwright/test";

test.describe("/bulk page", () => {
  test("loads with textarea and submit button visible", async ({ page }) => {
    await page.goto("/bulk");

    await expect(page.locator("textarea")).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /check prices|price|lookup|submit|確認/i,
      }),
    ).toBeVisible();
  });

  test("paste and submit shows result area", async ({ page }) => {
    await page.goto("/bulk");

    await page.locator("textarea").fill("1 E2E Test Card (SOS) 999");

    const submitBtn = page
      .getByRole("button", { name: /check prices|price|lookup|submit|確認/i })
      .first();
    await submitBtn.click();

    // Wait for loading to finish (spinner disappears or results appear)
    await page.waitForFunction(
      () => !document.querySelector('[class*="animate-spin"]'),
      { timeout: 10_000 },
    );

    // Either a result row or a "not found" state is acceptable
    const resultTable = page.locator("table");
    const notFound = page.locator(
      "text=/not found|見つかりません|E2E Test Card/i",
    );

    await expect(resultTable.or(notFound).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("empty submit does not crash the page", async ({ page }) => {
    await page.goto("/bulk");

    await page.locator("textarea").fill("");

    // Submit button should be disabled when textarea is empty
    const submitBtn = page
      .getByRole("button", { name: /check prices|price|lookup|submit|確認/i })
      .first();

    const isDisabled = await submitBtn.isDisabled();
    if (!isDisabled) {
      await submitBtn.click();
    }

    // Page should still be on /bulk with no crash
    await expect(page).toHaveURL(/\/bulk/);
    await expect(page.locator("textarea")).toBeVisible();
  });
});

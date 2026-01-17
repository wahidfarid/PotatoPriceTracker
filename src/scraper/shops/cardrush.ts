
import { Shop, TrackedItem, PrismaClient } from '@prisma/client';
import { Browser } from 'playwright';

export async function scrapeCardRush(
    items: (TrackedItem & { shop: Shop; card: { name: string } })[],
    prisma: PrismaClient,
    browser: Browser
) {
    console.log(`[CardRush] Scraping ${items.length} items...`);
    const page = await browser.newPage();

    for (const item of items) {
        try {
            console.log(`[CardRush] Navigating to ${item.url}`);
            await page.goto(item.url);

            // Wait for price
            try {
                await page.waitForSelector('.price .selling_price .figure', { timeout: 10000 });
            } catch (e) {
                console.log(`[CardRush] Price selector not found for ${item.url}`);
                continue;
            }

            // Extract price
            // 1,980円 -> 1980
            const priceText = await page.$eval('.price .selling_price .figure', el => el.textContent);
            if (!priceText) {
                console.log(`[CardRush] Price text empty for ${item.url}`);
                continue;
            }

            const priceYen = parseInt(priceText.replace(/[^\d]/g, ''));
            console.log(`[CardRush] ${item.card.name}: ${priceYen} Yen`);

            await prisma.price.create({
                data: {
                    trackedItemId: item.id,
                    shopId: item.shopId,
                    priceYen: priceYen,
                    buyPriceYen: null, // TODO: Implement Kaitori
                }
            });

        } catch (e) {
            console.error(`[CardRush] Error scraping ${item.id}:`, e);
        }
    }
    await page.close();
}

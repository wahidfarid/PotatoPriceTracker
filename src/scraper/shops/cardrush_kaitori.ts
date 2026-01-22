
import { PrismaClient } from '@prisma/client';
import { Browser } from 'playwright';

export async function scrapeCardRushKaitori(
    setCode: string,
    prisma: PrismaClient,
    browser: Browser
) {
    console.log(`[CardRush Kaitori] Starting crawl for set: ${setCode}`);

    const shop = await prisma.shop.findUniqueOrThrow({ where: { name: 'CardRush' } });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        // Navigate to buying prices page
        await page.goto('https://cardrush.media/mtg/buying_prices', { waitUntil: 'domcontentloaded' });

        // Wait for search form to be visible
        await page.waitForSelector('input[name="keyword"]', { timeout: 10000 });

        // Fill in SET search field and submit
        await page.fill('input[name="keyword"]', setCode.toUpperCase());

        // Click search button
        await page.click('button[type="submit"]');
        await page.waitForLoadState('networkidle');

        // Wait for results table to load
        try {
            await page.waitForSelector('table tbody tr', { timeout: 10000 });
        } catch (error) {
            console.error(`[CardRush Kaitori] Timeout waiting for results table on ${page.url()}`);
            console.error(`Error details:`, error);
            throw error;
        }

        let currentPage = 1;
        let hasNext = true;

        while (hasNext) {
            console.log(`[CardRush Kaitori] Scraping page ${currentPage}`);

            // Extract card data from table rows
            const cards = await page.$$eval('table tbody tr', (rows) => {
                return rows.map(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 4) return null;

                    const cardInfo = cells[0]?.textContent?.trim() || '';
                    const setCode = cells[1]?.textContent?.trim() || '';
                    const language = cells[2]?.textContent?.trim() || '';
                    const buyPrice = cells[3]?.textContent?.trim() || '';

                    return { cardInfo, setCode, language, buyPrice };
                }).filter(Boolean);
            });

            if (cards.length === 0) {
                hasNext = false;
                break;
            }

            for (const cardData of cards) {
                if (!cardData) continue;

                const title = cardData.cardInfo;
                const priceText = cardData.buyPrice;
                const priceYen = parseInt(priceText.replace(/[^0-9]/g, ''), 10);

                if (isNaN(priceYen) || priceYen === 0) continue;

                // Skip sealed products
                if (title.includes('Box') || title.includes('Pack') || title.includes('Supply')) continue;

                // Parse foil status from title
                const isFoil = title.includes('(FOIL)') || title.includes('Foil') || title.includes('[Foil]');

                // Determine language
                let lang = 'JP';
                if (cardData.language === '英語' || title.includes('English') || title.includes('【Eng】')) {
                    lang = 'EN';
                }

                // Extract card name (remove foil markers, set codes, etc.)
                let cardName = title
                    .replace(/\(FOIL\)/gi, '')
                    .replace(/\[Foil\]/gi, '')
                    .replace(/【.*?】/g, '')
                    .replace(/\[.*?\]/g, '')
                    .split('/')[0]
                    .trim();

                // Try to extract collector number if present
                const cnMatch = title.match(/\((\d+)\)/) || title.match(/#(\d+)/);
                let collectorNumber = cnMatch ? parseInt(cnMatch[1], 10).toString() : null;

                // Find variant (preferring collector number match)
                let variant = null;
                if (collectorNumber) {
                    variant = await prisma.cardVariant.findFirst({
                        where: {
                            setCode: setCode.toUpperCase(),
                            collectorNumber: collectorNumber,
                            language: lang,
                            isFoil: isFoil
                        }
                    });
                }

                // Fallback to name matching
                if (!variant && cardName) {
                    const variants = await prisma.cardVariant.findMany({
                        where: {
                            card: { name: { contains: cardName } },
                            setCode: setCode.toUpperCase(),
                            language: lang,
                            isFoil: isFoil
                        }
                    });
                    if (variants.length === 1) variant = variants[0];
                }

                if (variant) {
                    // Check for recent price record (within 24h)
                    const recentPrice = await prisma.price.findFirst({
                        where: {
                            variantId: variant.id,
                            shopId: shop.id,
                            timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                        },
                        orderBy: { timestamp: 'desc' }
                    });

                    if (recentPrice) {
                        // Update existing record with buy price
                        await prisma.price.update({
                            where: { id: recentPrice.id },
                            data: {
                                buyPriceYen: priceYen,
                                sellSourceUrl: `https://cardrush.media/mtg/buying_prices`
                            }
                        });
                    } else {
                        // Create new record, carry over last priceYen if available
                        const lastSetPrice = await prisma.price.findFirst({
                            where: {
                                variantId: variant.id,
                                shopId: shop.id,
                                priceYen: { gt: 0 },
                                timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                            },
                            orderBy: { timestamp: 'desc' }
                        });

                        await prisma.price.create({
                            data: {
                                variantId: variant.id,
                                shopId: shop.id,
                                priceYen: lastSetPrice?.priceYen || 0,
                                stock: lastSetPrice?.stock || 0,
                                buyPriceYen: priceYen,
                                sellSourceUrl: `https://cardrush.media/mtg/buying_prices`
                            }
                        });
                    }
                } else {
                    console.log(`[CardRush Kaitori] No match for ${cardName} (${lang}/${isFoil ? 'Foil' : 'Normal'})`);
                }
            }

            // Check for next page pagination
            const nextButton = page.locator('button:has-text("次へ"), a:has-text("次へ")').first();
            const isVisible = await nextButton.isVisible().catch(() => false);
            const isEnabled = !await nextButton.isDisabled().catch(() => true);

            if (isVisible && isEnabled) {
                try {
                    await nextButton.click();
                    await page.waitForLoadState('networkidle');
                    await page.waitForSelector('table tbody tr', { timeout: 10000 });
                    currentPage++;
                } catch (error) {
                    console.error(`[CardRush Kaitori] Navigation error on page ${currentPage}: ${error}`);
                    hasNext = false;
                }
            } else {
                hasNext = false;
            }
        }

    } catch (e) {
        console.error(`[CardRush Kaitori] Error:`, e);
    } finally {
        await context.close();
    }
}

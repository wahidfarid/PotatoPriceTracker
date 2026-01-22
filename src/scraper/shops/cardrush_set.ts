
import { PrismaClient } from '@prisma/client';
import { Browser } from 'playwright';

export async function scrapeCardRushSet(
    setCode: string, // "ECL"
    prisma: PrismaClient,
    browser: Browser
) {
    console.log(`[CardRush] Starting crawl for set: ${setCode}`);
    const page = await browser.newPage();

    // Search for the set
    // CardRush usually works with English keyword if it's in the title, or Japanese.
    // Try using the set code directly as the search term
    const query = setCode.toUpperCase();
    const shop = await prisma.shop.findUniqueOrThrow({ where: { name: 'CardRush' } });

    try {
        await page.goto(`https://www.cardrush-mtg.jp/product-list?keyword=${encodeURIComponent(query)}`);

        let hasNext = true;
        while (hasNext) {
            console.log(`[CardRush] Scraping page: ${page.url()}`);

            try {
                await page.waitForSelector('.item_data_list', { timeout: 10000 });
            } catch (error) {
                console.error(`[CardRush] Timeout waiting for selector '.item_data_list' on ${page.url()}`);
                console.error(`Error details:`, error);
                throw error;
            }
            const items = await page.$$('.item_data_list .item_data');

            for (const item of items) {
                try {
                    // CardRush structure:
                    // .item_data (container)
                    //   .item_name_area > a (link + text)
                    //   .selling_price > .figure (price)

                    const titleEl = await item.$('.item_name_area a');
                    const title = await titleEl?.textContent();
                    const href = await item.$eval('.item_name_area a', (a) => (a as HTMLAnchorElement).href);
                    const priceEl = await item.$('.selling_price .figure');
                    const priceText = await priceEl?.textContent();

                    if (!title || !priceText) continue;

                    const isFoil = title.includes('[Foil]') || title.includes('Foil'); // CardRush often puts [Foil]
                    const isJP = title.includes('Japanese') || !title.includes('English'); // Check negative or specific tag. 
                    // CardRush usually lists "Name / Name" (JP/EN).
                    // If it says "English" explicitly it's EN.
                    // Often: "Sheoldred, the Apocalypse [Foil] [Dominaria United]"
                    const isEN = title.includes('English') || title.includes('【Eng】');

                    // Standardize Language
                    let lang = 'JP'; // Default to JP on JP site unless marked EN
                    if (isEN) lang = 'EN';

                    // Name parsing
                    // CardRush titles are messy.
                    // "Sheoldred, the Apocalypse/黙示録、シェオルドレッド [Foil] [Dominaria United]"
                    // We can extract EN name part.

                    let cardName = title.split('/')[0].trim();
                    // Remove [Tags]
                    cardName = cardName.replace(/\[.*?\]/g, '').trim();

                    // Extract collector number from title
                    // Patterns: "(267)", "#267"
                    const cnMatch = title.match(/\((\d+)\)/) || title.match(/#(\d+)/);
                    let collectorNumber = cnMatch ? parseInt(cnMatch[1], 10).toString() : null;

                    const priceYen = parseInt(priceText.replace(/[^\d]/g, ''));

                    // Try to extract stock information
                    // Look for patterns like "在庫数 X枚" or "在庫なし"
                    const stockMatch = await item.$eval('.stock_num', (el) => el.textContent).catch(() => null);
                    let stockCount = 0;
                    if (stockMatch) {
                        const stockNumMatch = stockMatch.match(/(\d+)/);
                        stockCount = stockNumMatch ? parseInt(stockNumMatch[1], 10) : 0;
                    }

                    // Find Variant - Priority 1: Collector Number Match
                    let variants: any[] = [];

                    if (collectorNumber) {
                        variants = await prisma.cardVariant.findMany({
                            where: {
                                setCode: setCode.toUpperCase(),
                                collectorNumber: collectorNumber,
                                language: lang,
                                isFoil: isFoil
                            },
                            include: { card: true }
                        });
                    }

                    // Priority 2: Fallback to Name Match
                    if (variants.length === 0) {
                        variants = await prisma.cardVariant.findMany({
                            where: {
                                card: { name: { contains: cardName } },
                                language: lang,
                                isFoil: isFoil,
                                setCode: setCode.toUpperCase()
                            },
                            include: { card: true }
                        });
                    }

                    if (variants.length === 1) {
                        const v = variants[0];

                        // Check for recent kaitori (buy price) data to carry over
                        const latestKaitori = await prisma.price.findFirst({
                            where: {
                                variantId: v.id,
                                shopId: shop.id,
                                buyPriceYen: { not: null },
                                timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                            },
                            orderBy: { timestamp: 'desc' }
                        });

                        await prisma.price.create({
                            data: {
                                variantId: v.id,
                                shopId: shop.id,
                                priceYen: priceYen,
                                stock: stockCount,
                                sourceUrl: href,
                                buyPriceYen: latestKaitori?.buyPriceYen,
                                sellSourceUrl: latestKaitori?.sellSourceUrl
                            }
                        });
                        // console.log(`[CardRush] Updated ${cardName}: ${priceYen}`);
                    } else {
                        console.log(`[CardRush] No unique match for ${cardName} (${lang}/${isFoil ? 'Foil' : 'Normal'}) - found ${variants.length} matches`);
                    }

                } catch (e) {
                    // ignore
                }
            }

            // Next page
            const nextBtn = await page.$('.pager_next');
            // If it's a link, click it.
            // CardRush usually uses <a> for pager.
            // Check if disabled or valid.
            if (nextBtn) {
                try {
                    await Promise.all([
                        page.waitForNavigation({ timeout: 30000, waitUntil: 'networkidle' }),
                        nextBtn.click(),
                    ]);
                } catch (error) {
                    console.error(`[CardRush] Navigation timeout on ${page.url()}`);
                    console.error(`Error details:`, error);
                    hasNext = false;
                }
            } else {
                hasNext = false;
            }
        }

    } catch (e) {
        console.error(`[CardRush] Error:`, e);
    } finally {
        await page.close();
    }
}

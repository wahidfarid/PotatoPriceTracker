import { PrismaClient } from '@prisma/client';
import { Browser } from 'playwright';

export async function scrapeHareruyaKaitori(
    setCode: string,
    prisma: PrismaClient,
    browser: Browser
) {
    console.log(`[Hareruya Kaitori] Starting HTML crawl for set: ${setCode}`);

    const shop = await prisma.shop.findUniqueOrThrow({ where: { name: 'Hareruya' } });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    let currentPage = 1;
    let hasNext = true;

    while (hasNext) {
        const url = `https://www.hareruyamtg.com/ja/purchase/search?product=${encodeURIComponent(setCode)}&page=${currentPage}`;
        console.log(`[Hareruya Kaitori] Fetching ${url}`);

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });

            const cards = await page.$$eval('.itemList', (items) => {
                return items.map(item => {
                    const name = item.querySelector('.itemName')?.textContent?.trim() || '';
                    const priceText = item.querySelector('.itemDetail__price')?.textContent?.trim() || '';
                    const href = (item.querySelector('.itemName') as HTMLAnchorElement)?.href || '';
                    return { name, priceText, href };
                });
            });

            if (cards.length === 0) {
                hasNext = false;
                break;
            }

            for (const cardData of cards) {
                const title = cardData.name;
                const priceYen = parseInt(cardData.priceText.replace(/[^0-9]/g, ''), 10);
                if (isNaN(priceYen)) continue;

                // Simple skip for sealed product
                if (title.includes('Box') || title.includes('Pack') || title.includes('Supply')) continue;

                // Match Code
                if (!title.includes(`[${setCode.toUpperCase()}]`) && !title.includes(`[${setCode.toUpperCase()}-`)) continue;

                const cnMatch = title.match(/\((\d+)\)/);
                let collectorNumber = cnMatch ? cnMatch[1] : null;
                if (collectorNumber) collectorNumber = parseInt(collectorNumber, 10).toString();

                let lang = 'JP';
                if (title.includes('【EN】') || title.includes('[EN]') || title.includes('英語版')) lang = 'EN';

                const isFoil = title.includes('Foil') || title.includes('【Foil】');

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

                if (variant) {
                    // Find a very recent price record for this variant/shop (today)
                    const recentPrice = await prisma.price.findFirst({
                        where: {
                            variantId: variant.id,
                            shopId: shop.id,
                            timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // within 24h
                        },
                        orderBy: { timestamp: 'desc' }
                    });

                    if (recentPrice) {
                        await prisma.price.update({
                            where: { id: recentPrice.id },
                            data: {
                                buyPriceYen: priceYen,
                                sellSourceUrl: cardData.href
                            }
                        });
                    } else {
                        // Also find latest record with price data to carry over if we're creating a new one
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
                                sellSourceUrl: cardData.href
                            }
                        });
                    }
                }
            }

            // Simple check for next page (search for "次へ" or similar)
            const nextExists = await page.$('.result_pagenum a:text("次へ")'); // This is a guess, Hareruya usually has pagination links
            // Actually let's just increment and check card count
            if (cards.length < 20) { // Assuming 30 items per page
                hasNext = false;
            } else {
                currentPage++;
            }

        } catch (e) {
            console.error(`[Hareruya Kaitori] Error on page ${currentPage}:`, e);
            hasNext = false;
        }
    }

    await context.close();
}

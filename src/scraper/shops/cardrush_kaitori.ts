
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
        let currentPage = 1;
        let hasNext = true;

        while (hasNext) {
            console.log(`[CardRush Kaitori] Scraping page ${currentPage}`);

            // Navigate directly to buying prices page with set code filter
            const url = `https://cardrush.media/mtg/buying_prices?pack_code=${setCode.toUpperCase()}&limit=100&page=${currentPage}`;
            await page.goto(url, { waitUntil: 'domcontentloaded' });

            // Extract __NEXT_DATA__ script tag
            const nextDataScript = await page.locator('#__NEXT_DATA__').textContent();
            if (!nextDataScript) {
                console.error(`[CardRush Kaitori] Could not find __NEXT_DATA__ on page ${currentPage}`);
                break;
            }

            const nextData = JSON.parse(nextDataScript);
            const buyingPrices = nextData?.props?.pageProps?.buyingPrices || [];

            console.log(`[CardRush Kaitori] Found ${buyingPrices.length} cards on page ${currentPage}`);

            if (buyingPrices.length === 0) {
                hasNext = false;
                break;
            }

            for (const card of buyingPrices) {
                if (!card) continue;

                // Extract price from JSON (already a number)
                const priceYen = card.amount;
                if (!priceYen || priceYen === 0) continue;

                // Skip sealed products (check card name)
                const fullName = card.name || '';
                if (fullName.includes('Box') || fullName.includes('Pack') || fullName.includes('Supply')) continue;

                // Parse card name in "日本語名/English Name" format
                const nameParts = fullName.split('/');
                let cardName = '';
                if (nameParts.length > 1) {
                    // Use English name (after /)
                    cardName = nameParts[1].trim();
                } else {
                    // No / separator, use full name
                    cardName = fullName.trim();
                }

                // Parse foil status from full name (FOIL prefix appears before / separator)
                const isFoil = fullName.includes('(FOIL)') || fullName.includes('Foil') || fullName.includes('[Foil]');

                // Clean card name (remove foil markers)
                cardName = cardName
                    .replace(/\(FOIL\)/gi, '')
                    .replace(/\[Foil\]/gi, '')
                    .replace(/\(Foil\)/gi, '')
                    .trim();

                // Determine language from JSON field
                let lang = 'JP';
                if (card.language === '英語') {
                    lang = 'EN';
                }

                // Try to extract collector number if present in name
                const cnMatch = cardName.match(/\((\d+)\)/) || cardName.match(/#(\d+)/);
                let collectorNumber = cnMatch ? parseInt(cnMatch[1], 10).toString() : null;

                // Clean collector number from card name if found
                if (collectorNumber) {
                    cardName = cardName.replace(/\((\d+)\)/, '').replace(/#(\d+)/, '').trim();
                }

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
                        },
                        orderBy: { collectorNumber: 'asc' }
                    });

                    if (variants.length > 0) {
                        // Try to extract collector number from card name (e.g., "(0319)")
                        const cnInNameMatch = fullName.match(/\(0*(\d+)\)/);
                        if (cnInNameMatch && variants.length > 1) {
                            const cnInName = parseInt(cnInNameMatch[1], 10).toString();
                            const matchingVariant = variants.find(v => v.collectorNumber === cnInName);
                            if (matchingVariant) {
                                variant = matchingVariant;
                            }
                        }

                        // If no collector number match, check if card name indicates special frame
                        if (!variant) {
                            const isShowcase = fullName.includes('(ショーケース枠)') || fullName.includes('(ショーケース)');
                            const isExtendedArt = fullName.includes('(フルアート)') || fullName.includes('(拡張アート)');

                            if ((isShowcase || isExtendedArt) && variants.length > 1) {
                                // Try to match extended art or showcase variant
                                const specialVariant = variants.find(v =>
                                    v.frameEffects && (
                                        (isShowcase && v.frameEffects.includes('showcase')) ||
                                        (isExtendedArt && v.frameEffects.includes('extendedart'))
                                    )
                                );
                                variant = specialVariant || variants[0];
                            } else {
                                // Use the first variant (lowest collector number = main set version)
                                variant = variants[0];
                            }
                        }
                    }
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

                        if (lastSetPrice?.priceYen) {
                            await prisma.price.create({
                                data: {
                                    variantId: variant.id,
                                    shopId: shop.id,
                                    priceYen: lastSetPrice.priceYen,
                                    stock: lastSetPrice.stock || 0,
                                    buyPriceYen: priceYen,
                                    sellSourceUrl: `https://cardrush.media/mtg/buying_prices`
                                }
                            });
                        } else {
                            console.log(`[CardRush Kaitori] Skipping ${variant.id} - no valid priceYen to carry over`);
                        }
                    }
                } else {
                    console.log(`[CardRush Kaitori] No match for ${cardName} (${lang}/${isFoil ? 'Foil' : 'Normal'})`);
                }
            }

            // Move to next page (URL parameter will be updated in next iteration)
            currentPage++;
        }

    } catch (e) {
        console.error(`[CardRush Kaitori] Error:`, e);
    } finally {
        await context.close();
    }
}

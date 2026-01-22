
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
                await page.waitForSelector('a.item_data_link', { timeout: 10000 });
            } catch (error) {
                console.error(`[CardRush] Timeout waiting for selector 'a.item_data_link' on ${page.url()}`);
                console.error(`Error details:`, error);
                throw error;
            }
            const items = await page.$$('a.item_data_link');

            for (const item of items) {
                try {
                    // CardRush structure:
                    // a.item_data_link (container)
                    //   .item_name > .goods_name (product name)
                    //   .selling_price > .figure (price)
                    //   .stock (stock info)

                    const titleEl = await item.$('.item_name .goods_name');
                    const title = await titleEl?.textContent();
                    const relativeHref = await item.getAttribute('href');
                    const priceEl = await item.$('.selling_price .figure');
                    const priceText = await priceEl?.textContent();

                    if (!title || !priceText || !relativeHref) continue;

                    // Convert relative URL to absolute
                    const href = relativeHref.startsWith('http')
                        ? relativeHref
                        : `https://www.cardrush-mtg.jp${relativeHref}`;

                    // Parse variant type from Japanese keywords
                    const isShowcase = title.includes('(ショーケース枠)');
                    const isDoubleRainbow = title.includes('(ダブルレインボウFOIL)');
                    const isFullArt = title.includes('(Full Art)') || title.includes('(フルアート)');
                    const isFracture = title.includes('Fracture FOIL') ||
                                       title.includes('フラクチャーFOIL') ||
                                       title.includes('(Fracture)');
                    const isFoil = title.includes('(FOIL)') || isDoubleRainbow || isFracture;

                    // Parse language from 《英語》 or 《日本語》
                    const isEN = title.includes('《英語》');
                    const lang = isEN ? 'EN' : 'JP';

                    // Extract collector number: "(0313)" -> "313"
                    const cnMatch = title.match(/\(0*(\d+)\)/);
                    let collectorNumber: string | null = null;
                    if (cnMatch) {
                        collectorNumber = parseInt(cnMatch[1], 10).toString();
                    }

                    // Name parsing
                    // CardRush titles: "苦花を携える者/Bitterbloom Bearer《日本語》【ECL】"
                    // Extract English name (after the /)
                    let cardName = '';
                    if (title.includes('/')) {
                        // Get the part after /
                        cardName = title.split('/')[1]
                            .split('《')[0] // Remove language marker
                            .trim();
                    } else {
                        // Fallback: get first part and clean
                        cardName = title.split('《')[0].trim();
                    }

                    // Remove condition tags like [EX+], variant tags, etc
                    cardName = cardName
                        .replace(/\[EX\+\]/g, '')
                        .replace(/\(FOIL\)/g, '')
                        .replace(/\(ショーケース枠\)/g, '')
                        .replace(/\(ダブルレインボウFOIL\)/g, '')
                        .replace(/\(Full Art\)/g, '')
                        .replace(/\(フルアート\)/g, '')
                        .replace(/\(Fracture FOIL\)/g, '')
                        .replace(/\(フラクチャーFOIL\)/g, '')
                        .replace(/\(0*\d+\)/g, '')  // Remove collector numbers
                        .trim();

                    const priceYen = parseInt(priceText.replace(/[^\d]/g, ''));

                    // Try to extract stock information
                    // Look for patterns like "在庫数 X枚" or "在庫なし"
                    const stockMatch = await item.$eval('.stock', (el) => el.textContent).catch(() => null);
                    let stockCount = 0;
                    if (stockMatch) {
                        const stockNumMatch = stockMatch.match(/(\d+)/);
                        stockCount = stockNumMatch ? parseInt(stockNumMatch[1], 10) : 0;
                    }

                    let variants: any[] = [];

                    // Strategy 1: Collector number (most precise - uses unique constraint)
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

                    // Strategy 2: Fallback to name + variant type (only if no collector number)
                    if (variants.length === 0 && !collectorNumber) {
                        const whereClause: any = {
                            card: { name: cardName },
                            language: lang,
                            isFoil: isFoil,
                            setCode: setCode.toUpperCase()
                        };

                        if (isFracture) {
                            whereClause.promoTypes = { contains: 'fracturefoil' };
                        } else if (isShowcase) {
                            whereClause.frameEffects = { contains: 'showcase' };
                        } else if (isDoubleRainbow) {
                            whereClause.promoTypes = { contains: 'doublerainbow' };
                        } else if (isFullArt) {
                            // CardRush uses (フルアート) for both inverted AND extendedart
                            whereClause.OR = [
                                { frameEffects: { contains: 'inverted' } },
                                { frameEffects: { contains: 'extendedart' } }
                            ];
                        } else {
                            // Base variant: exclude special frame variants (not just null)
                            // Cards may have frameEffects like "legendary" or "enchantment"
                            whereClause.NOT = [
                                { frameEffects: { contains: 'showcase' } },
                                { frameEffects: { contains: 'extendedart' } },
                                { frameEffects: { contains: 'inverted' } }
                            ];
                            whereClause.OR = [
                                { promoTypes: null },
                                { NOT: { promoTypes: { contains: 'doublerainbow' } } }
                            ];
                        }

                        variants = await prisma.cardVariant.findMany({
                            where: whereClause,
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
                        console.log(`[CardRush] Matched ${cardName} -> CN:${v.collectorNumber} (${lang}/${isFoil ? 'Foil' : 'Normal'})`);
                    } else if (variants.length === 0) {
                        console.log(`[CardRush] NO MATCH: "${cardName}" | CN:${collectorNumber || 'none'} | ${lang}/${isFoil ? 'Foil' : 'Normal'}`);
                    } else {
                        const candidateCNs = variants.map(v => v.collectorNumber).join(', ');
                        console.log(`[CardRush] AMBIGUOUS: "${cardName}" | parsed CN:${collectorNumber || 'none'} | found ${variants.length}: [${candidateCNs}]`);
                    }

                } catch (e) {
                    // ignore
                }
            }

            // Next page
            const nextBtn = await page.$('.to_next_page');
            // If it's a link, click it.
            // CardRush uses <a class="to_next_page pager_btn"> for next page
            if (nextBtn) {
                try {
                    await Promise.all([
                        page.waitForNavigation({ timeout: 30000, waitUntil: 'domcontentloaded' }),
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

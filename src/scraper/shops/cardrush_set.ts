
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
    // "Lorwyn Eclipsed" -> "ローウィン・エクリプス"
    // Let's try "Lorwyn Eclipsed" first.

    const query = "Lorwyn Eclipsed";
    const shop = await prisma.shop.findUniqueOrThrow({ where: { name: 'CardRush' } });

    try {
        await page.goto(`https://www.cardrush-mtg.jp/product-list?keyword=${encodeURIComponent(query)}`);

        let hasNext = true;
        while (hasNext) {
            console.log(`[CardRush] Scraping page: ${page.url()}`);

            await page.waitForSelector('.item_data_list', { timeout: 10000 });
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

                    const priceYen = parseInt(priceText.replace(/[^\d]/g, ''));

                    // Find Variant
                    const variants: any[] = await prisma.cardVariant.findMany({
                        where: {
                            card: { name: { contains: cardName } }, // Fuzzy match
                            language: lang,
                            isFoil: isFoil,
                            setCode: setCode.toUpperCase()
                        },
                        include: { card: true }
                    });

                    if (variants.length === 1) {
                        const v = variants[0];
                        await prisma.price.create({
                            data: {
                                variantId: v.id,
                                shopId: shop.id,
                                priceYen: priceYen,
                                sourceUrl: href
                            }
                        });
                        // console.log(`[CardRush] Updated ${cardName}: ${priceYen}`);
                    } else {
                        console.log(`[CardRush] No unique match for ${cardName} (${lang}/${isFoil ? 'Foil' : 'Normal'})`);
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
                await Promise.all([
                    page.waitForNavigation(),
                    nextBtn.click(),
                ]);
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

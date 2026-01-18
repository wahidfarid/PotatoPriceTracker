
import { PrismaClient } from '@prisma/client';
import { Browser } from 'playwright';

export async function scrapeHareruyaSet(
    setCode: string, // "ECL"
    prisma: PrismaClient,
    browser: Browser // Unused but kept for signature
) {
    console.log(`[Hareruya] Starting API crawl for set: ${setCode}`);

    // Query for "[ECL]" or set name. Using "[ECL]" is quite specific on Hareruya.
    // URL: https://www.hareruyamtg.com/ja/products/search/unisearch_api?kw=%5BECL%5D

    const query = `[${setCode}]`;

    const shop = await prisma.shop.findUniqueOrThrow({ where: { name: 'Hareruya' } });

    let page = 1;
    const rows = 30;
    let hasNext = true;

    while (hasNext) {
        const url = `https://www.hareruyamtg.com/ja/products/search/unisearch_api?kw=${encodeURIComponent(query)}&rows=${rows}&page=${page}`;
        // console.log(`[Hareruya] Fetching ${url}`);

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`API ${res.status}`);
            const json = await res.json();

            const docs = json.response?.docs || [];
            if (docs.length === 0) {
                hasNext = false;
                break;
            }

            console.log(`[Hareruya] Page ${page}: ${docs.length} items`);

            for (const doc of docs) {
                // Parse doc
                // "product_name": "《Card Name》[ECL]"
                // "product_name_en": "《Card Name》[ECL]"
                // "price": "123"
                // "language": "1" ?? Need to map. Or parse from title.
                // "foil_flg": "0" or "1"? Sample had "foil_flg": "0".

                const title = doc.product_name;

                // Skip sealed product (Box, Pack, Supply)
                const isSealed = title.includes('Box') || title.includes('Pack') || title.includes('Supply') || title.includes('スリーブ') || title.includes('デッキ') || title.includes('30パック');
                if (isSealed) continue;

                // STRICT SET CHECK
                // Hareruya search is fuzzy.
                // Format: "... [ECL]" or "[ECL-BF]" (Booster Fun)
                const setTag = `[${setCode.toUpperCase()}]`;
                const setTagPrefix = `[${setCode.toUpperCase()}-`;

                if (!title.includes(setTag) && !title.includes(setTagPrefix)) {
                    // console.log(`Skipping non-set item: ${title}`);
                    continue;
                }

                const priceYen = parseInt(doc.price);
                const productUrl = `https://www.hareruyamtg.com/ja/products/detail/${doc.product}`;

                // Parse Lang using API field
                // 1 = JP, 2 = EN
                let lang = 'JP';
                if (doc.language == 2) {
                    lang = 'EN';
                } else if (doc.language == 1) {
                    lang = 'JP';
                } else {
                    // Fallback to title
                    if (title.includes('English') || title.includes('英語版') || title.includes('【EN】') || title.includes('[EN]')) lang = 'EN';
                }

                const isFoil = title.includes('Foil') || title.includes('【Foil】') || doc.foil_flg == 1;

                // Clean Card Name
                // Prefer English name from product_name_en if available for matching
                let matchName = null;

                if (doc.product_name_en) {
                    const enNameMatch = doc.product_name_en.match(/《(.*?)》/);
                    if (enNameMatch) matchName = enNameMatch[1];
                }

                if (!matchName) {
                    const nameMatch = title.match(/《(.*?)》/);
                    if (nameMatch) {
                        let extracted = nameMatch[1];
                        if (extracted.includes('/')) extracted = extracted.split('/')[1].trim();
                        matchName = extracted;
                    }
                }

                // MATCHING STRATEGY
                // 1. Try Collector Number + Lang + Foil (Most Precise)
                // Hareruya title format: "(267)《...》" or "【Foil】(267)..."
                // Regex to capture number inside parens ()

                const cnMatch = title.match(/\((\d+)\)/);
                let collectorNumber = cnMatch ? cnMatch[1] : null;

                // Normalize: "052" -> "52"
                if (collectorNumber) {
                    collectorNumber = parseInt(collectorNumber, 10).toString();
                }

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

                // 2. If no match by CN, fallback to Name
                if (variants.length === 0 && matchName) {
                    variants = await prisma.cardVariant.findMany({
                        where: {
                            card: { name: matchName },
                            language: lang,
                            isFoil: isFoil,
                            setCode: setCode.toUpperCase()
                        },
                        include: { card: true }
                    });
                }

                if (variants.length === 1) {
                    const v = variants[0];
                    const stock = parseInt(doc.stock || '0');

                    // Find latest record with kaitori data to carry over
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
                            stock: stock,
                            sourceUrl: productUrl,
                            buyPriceYen: latestKaitori?.buyPriceYen,
                            sellSourceUrl: latestKaitori?.sellSourceUrl
                        }
                    });
                } else {
                    // console.log(`[Hareruya] No match/Ambiguous for ${matchName} (${lang}/${isFoil ? 'Foil' : 'Normal'})`);
                }
            }

            if (json.response.numFound <= page * rows) {
                hasNext = false;
            } else {
                page++;
            }

        } catch (e) {
            console.error(`[Hareruya] API Error:`, e);
            hasNext = false;
        }
    }
}

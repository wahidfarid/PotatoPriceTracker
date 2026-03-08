import { PrismaClient } from '@prisma/client';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function scrapeCardRushKaitori(setCode: string, prisma: PrismaClient) {
    console.log(`[CardRush Kaitori] Starting crawl for set: ${setCode}`);

    const shop = await prisma.shop.findUniqueOrThrow({ where: { name: 'CardRush' } });

    const allVariants = await prisma.cardVariant.findMany({
        where: { setCode: setCode.toUpperCase() },
        include: { card: true }
    });

    const variantByCN = new Map<string, typeof allVariants[0]>();
    for (const v of allVariants) {
        variantByCN.set(`${v.collectorNumber}-${v.language}-${v.isFoil}`, v);
    }

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentPrices = await prisma.price.findMany({
        where: {
            variant: { setCode: setCode.toUpperCase() },
            shopId: shop.id,
            timestamp: { gte: cutoff }
        },
        orderBy: { timestamp: 'desc' }
    });

    const recentPriceMap = new Map<string, typeof recentPrices[0]>();
    for (const p of recentPrices) {
        if (!recentPriceMap.has(p.variantId)) recentPriceMap.set(p.variantId, p);
    }

    const toUpdate: { id: string; buyPriceYen: number }[] = [];
    const toCreate: any[] = [];

    try {
        let currentPage = 1;
        let hasNext = true;

        while (hasNext) {
            const url = `https://cardrush.media/mtg/buying_prices?pack_code=${setCode.toUpperCase()}&limit=100&page=${currentPage}`;
            console.log(`[CardRush Kaitori] Scraping page ${currentPage}`);

            const res = await fetch(url, { headers: { 'User-Agent': UA } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const html = await res.text();

            const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
            if (!match) {
                console.error(`[CardRush Kaitori] Could not find __NEXT_DATA__ on page ${currentPage}`);
                break;
            }

            const nextData = JSON.parse(match[1]);
            const buyingPrices = nextData?.props?.pageProps?.buyingPrices || [];

            console.log(`[CardRush Kaitori] Found ${buyingPrices.length} cards on page ${currentPage}`);
            if (buyingPrices.length === 0) { hasNext = false; break; }

            for (const card of buyingPrices) {
                if (!card) continue;

                const priceYen = card.amount;
                if (!priceYen || priceYen === 0) continue;

                const fullName = card.name || '';
                if (fullName.includes('Box') || fullName.includes('Pack') || fullName.includes('Supply')) continue;

                const nameParts = fullName.split('/');
                let cardName = nameParts.length > 1 ? nameParts[1].trim() : fullName.trim();

                const isFoil = fullName.includes('(FOIL)') || fullName.includes('Foil') || fullName.includes('[Foil]');
                cardName = cardName.replace(/\(FOIL\)/gi, '').replace(/\[Foil\]/gi, '').replace(/\(Foil\)/gi, '').trim();

                let lang = 'JP';
                if (card.language === '英語') lang = 'EN';

                const cnMatch = cardName.match(/\((\d+)\)/) || cardName.match(/#(\d+)/);
                let collectorNumber = cnMatch ? parseInt(cnMatch[1], 10).toString() : null;
                if (collectorNumber) {
                    cardName = cardName.replace(/\((\d+)\)/, '').replace(/#(\d+)/, '').trim();
                }

                let variant: typeof allVariants[0] | undefined;

                if (collectorNumber) {
                    variant = variantByCN.get(`${collectorNumber}-${lang}-${isFoil}`);
                }

                if (!variant && cardName) {
                    const candidates = allVariants.filter(v =>
                        v.card.name.includes(cardName) &&
                        v.language === lang &&
                        v.isFoil === isFoil
                    );

                    if (candidates.length > 0) {
                        const cnInNameMatch = fullName.match(/\(0*(\d+)\)/);
                        if (cnInNameMatch && candidates.length > 1) {
                            const cnInName = parseInt(cnInNameMatch[1], 10).toString();
                            variant = candidates.find(v => v.collectorNumber === cnInName);
                        }

                        if (!variant) {
                            const isShowcase = fullName.includes('(ショーケース枠)') || fullName.includes('(ショーケース)');
                            const isExtendedArt = fullName.includes('(フルアート)') || fullName.includes('(拡張アート)');

                            if ((isShowcase || isExtendedArt) && candidates.length > 1) {
                                const specialVariant = candidates.find(v =>
                                    v.frameEffects && (
                                        (isShowcase && v.frameEffects.includes('showcase')) ||
                                        (isExtendedArt && v.frameEffects.includes('extendedart'))
                                    )
                                );
                                variant = specialVariant || candidates[0];
                            } else {
                                variant = candidates[0];
                            }
                        }
                    }
                }

                if (variant) {
                    const recentPrice = recentPriceMap.get(variant.id);
                    if (recentPrice) {
                        toUpdate.push({ id: recentPrice.id, buyPriceYen: priceYen });
                    } else {
                        const lastSetPrice = recentPrices.find(p => p.variantId === variant!.id && p.priceYen > 0);
                        toCreate.push({
                            variantId: variant.id,
                            shopId: shop.id,
                            priceYen: lastSetPrice?.priceYen ?? 0,
                            stock: lastSetPrice?.stock ?? 0,
                            buyPriceYen: priceYen,
                            sellSourceUrl: `https://cardrush.media/mtg/buying_prices`
                        });
                    }
                } else {
                    console.log(`[CardRush Kaitori] No match for ${cardName} (${lang}/${isFoil ? 'Foil' : 'Normal'})`);
                }
            }

            currentPage++;
        }

    } catch (e) {
        console.error(`[CardRush Kaitori] Error:`, e);
    }

    if (toUpdate.length > 0) {
        await prisma.$transaction(
            toUpdate.map(u => prisma.price.update({
                where: { id: u.id },
                data: { buyPriceYen: u.buyPriceYen, sellSourceUrl: `https://cardrush.media/mtg/buying_prices` }
            }))
        );
    }
    if (toCreate.length > 0) {
        await prisma.price.createMany({ data: toCreate });
    }
    console.log(`[CardRush Kaitori] Updated ${toUpdate.length}, created ${toCreate.length} for ${setCode}`);
}

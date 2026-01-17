
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

async function main() {
    // 1. Check DB for specific cards
    const cardsToCheck = [
        { name: 'Steam Vents', collectorNumber: '348' },
        { name: 'Abigale, Eloquent First-Year', collectorNumber: null } // Check all for Abigale
    ];

    console.log('--- Database Check ---');

    // Custom search for Steam Vents 348
    const sv348 = await prisma.cardVariant.findFirst({
        where: { setCode: 'ECL', collectorNumber: '348' },
        include: { card: true }
    });
    if (sv348) {
        console.log(`FOUND Steam Vents #348! attached to card: ${sv348.card.name}`);
    } else {
        console.log('Steam Vents #348 NOT FOUND in DB searching by number.');
    }

    for (const c of cardsToCheck) {
        const where: any = { name: c.name };
        const card = await prisma.card.findFirst({
            where: { name: { contains: c.name } }, // Fuzzy to find it
            include: { variants: { where: { setCode: 'ECL' } } }
        });

        if (card) {
            console.log(`Found Card: ${card.name}`);
            for (const v of card.variants) {
                if (c.collectorNumber && v.collectorNumber !== c.collectorNumber) continue;

                const prices = await prisma.price.findMany({ where: { variantId: v.id }, include: { shop: true } });
                console.log(`- #${v.collectorNumber} ${v.language} Foil:${v.isFoil} ScryfallID:${v.scryfallId} -> Prices: ${prices.length}`);
                prices.forEach(p => console.log(`   * ${p.shop.name}: ¥${p.priceYen}`));
            }
        } else {
            console.log(`Card "${c.name}" not found in DB.`);
        }
    }

    // 2. Check Hareruya API
    console.log('\n--- Hareruya API Check ---');
    const queries = ["Steam Vents", "Abigale", "アビゲイル"];

    for (const q of queries) {
        console.log(`\nQuery: ${q}`);
        const url = `https://www.hareruyamtg.com/ja/products/search/unisearch_api?kw=${encodeURIComponent(q)}`;
        try {
            const res = await fetch(url);
            const json = await res.json();
            const docs = json.response?.docs || [];
            const eclItems = docs.filter((d: any) => d.product_name.includes('[ECL]') || d.product_name_en?.includes('[ECL]'));

            console.log(`Found ${eclItems.length} [ECL] items.`);
            eclItems.forEach((d: any) => {
                console.log(`  Title: ${d.product_name}`);
                console.log(`  EN Title: ${d.product_name_en}`);
                console.log(`  Price: ${d.price}`);
            });
        } catch (e) { console.error(e); }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

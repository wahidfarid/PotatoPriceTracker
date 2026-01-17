
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

async function main() {
    const name = "Heirloom Auntie";

    console.log('--- Database Check ---');
    const card = await prisma.card.findFirst({
        where: { name: { contains: name } },
        include: { variants: { where: { setCode: 'ECL' } } }
    });

    if (card) {
        console.log(`Found Card: ${card.name}`);
        for (const v of card.variants) {
            const prices = await prisma.price.findMany({ where: { variantId: v.id }, include: { shop: true } });
            console.log(`- #${v.collectorNumber} ${v.language} Foil:${v.isFoil} -> Prices: ${prices.length}`);
            prices.forEach(p => console.log(`   * ${p.shop.name}: ¥${p.priceYen} (${p.sourceUrl})`));
        }
    } else {
        console.log(`Card "${name}" not found in DB.`);
    }

    console.log('\n--- Hareruya API Check ---');
    // Query using English name first
    // Hareruya might use specific Katakana

    const query = "Heirloom Auntie";
    const url = `https://www.hareruyamtg.com/ja/products/search/unisearch_api?kw=${encodeURIComponent(query)}`;

    try {
        const res = await fetch(url);
        const json = await res.json();
        const docs = json.response?.docs || [];
        const eclItems = docs.filter((d: any) => d.product_name.includes('[ECL]') || d.product_name_en?.includes('[ECL]'));

        console.log(`Found ${eclItems.length} [ECL] items.`);
        eclItems.forEach((d: any) => {
            console.log(`\nItem: ${d.product_name}`);
            console.log(`  EN: ${d.product_name_en}`);
            console.log(`  Price: ${d.price}`);
            console.log(`  URL: https://www.hareruyamtg.com/ja/products/detail/${d.product}`);
        });

    } catch (e) { console.error(e); }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

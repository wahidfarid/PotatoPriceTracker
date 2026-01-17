
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

async function main() {
    // 1. Check DB for Steam Vents in ECL
    const card = await prisma.card.findFirst({
        where: { name: 'Steam Vents' },
        include: { variants: { where: { setCode: 'ECL' } } }
    });

    console.log('--- Database Check ---');
    if (card) {
        console.log(`Found Card: ${card.name} (${card.oracleId})`);
        console.log(`Variants in ECL: ${card.variants.length}`);

        for (const v of card.variants) {
            const prices = await prisma.price.findMany({ where: { variantId: v.id }, include: { shop: true } });
            console.log(`- #${v.collectorNumber} ${v.language} Foil:${v.isFoil} -> Prices: ${prices.length}`);
            prices.forEach(p => console.log(`   * ${p.shop.name}: ¥${p.priceYen}`));
        }
    } else {
        console.log('Card "Steam Vents" not found in DB.');
    }

    // 2. Check Hareruya API for Steam Vents
    console.log('\n--- Hareruya API Check ---');
    const query = "Steam Vents";
    const url = `https://www.hareruyamtg.com/ja/products/search/unisearch_api?kw=${encodeURIComponent(query)}`;

    try {
        const res = await fetch(url);
        const json = await res.json();
        const docs = json.response?.docs || [];

        const eclItems = docs.filter((d: any) => d.product_name.includes('[ECL]') || d.product_name_en?.includes('[ECL]'));

        console.log(`Found ${eclItems.length} items for Steam Vents in ECL.`);

        eclItems.forEach((d: any) => {
            console.log('\nItem:');
            console.log(`  Name (JP): ${d.product_name}`);
            console.log(`  Name (EN): ${d.product_name_en}`);
            console.log(`  Price: ${d.price}`);
            console.log(`  Lang: ${d.language}`);
            console.log(`  Foil: ${d.foil_flg}`);
        });

    } catch (e) {
        console.error('API Error:', e);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

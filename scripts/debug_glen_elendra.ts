
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

async function main() {
    const cn = '52';
    const name = "Glen Elendra's Answer"; // or fuzzy

    console.log('--- Database Check ---');
    const variants = await prisma.cardVariant.findMany({
        where: { setCode: 'ECL', collectorNumber: cn },
        include: { card: true }
    });

    if (variants.length > 0) {
        console.log(`Found ${variants.length} variants for #${cn}:`);
        variants.forEach(async v => {
            const prices = await prisma.price.findMany({ where: { variantId: v.id }, include: { shop: true } });
            console.log(`- ${v.card.name} (${v.language}/${v.isFoil}) -> Prices: ${prices.length}`);
            prices.forEach(p => console.log(`   * ${p.shop.name}: ¥${p.priceYen}`));
        });
    } else {
        console.log(`No variants found for #${cn} in DB.`);
    }

    // Custom search for name in DB to verify it exists
    const card = await prisma.card.findFirst({ where: { name: { contains: "Glen" } } });
    if (card) console.log(`Card with 'Glen' found: ${card.name}`);

    console.log('\n--- Hareruya API Check ---');
    // Query 1: Name
    // Query 2: Collector Number? searching by CN directly in Hareruya is tricky, usually part of title.

    const query = "Glen Elendra's Answer"; // Try English name first
    const url = `https://www.hareruyamtg.com/ja/products/search/unisearch_api?kw=${encodeURIComponent(query)}`;

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

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

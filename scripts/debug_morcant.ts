import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";

const prisma = new PrismaClient();

async function main() {
  const cn = "373";
  const name = "High Perfect Morcant"; //

  console.log("--- Database Check ---");
  const variants = await prisma.cardVariant.findMany({
    where: { setCode: "ECL", collectorNumber: cn },
    include: { card: true },
  });

  if (variants.length > 0) {
    console.log(`Found ${variants.length} variants for #${cn}:`);
    for (const v of variants) {
      const prices = await prisma.price.findMany({
        where: { variantId: v.id },
        include: { shop: true },
      });
      console.log(
        `- ${v.card.name} (${v.language}/${v.isFoil}) -> Prices: ${prices.length}`,
      );
      prices.forEach((p) => console.log(`   * ${p.shop.name}: ¥${p.priceYen}`));
    }
  } else {
    console.log(`No variants found for #${cn} in DB.`);
  }

  console.log("\n--- Hareruya API Check ---");
  const query = "High Perfect Morcant";
  const url = `https://www.hareruyamtg.com/ja/products/search/unisearch_api?kw=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    const docs = json.response?.docs || [];

    // Dump ALL docs to see what they look like, regardless of my filter
    console.log(`API returned ${docs.length} docs.`);

    docs.forEach((d: any) => {
      console.log(`\nItem: ${d.product_name}`);
      console.log(`  EN: ${d.product_name_en}`);
      console.log(`  Price: ${d.price}`);
      console.log(`  Set Check '[ECL]': ${d.product_name.includes("[ECL]")}`);
    });
  } catch (e) {
    console.error(e);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

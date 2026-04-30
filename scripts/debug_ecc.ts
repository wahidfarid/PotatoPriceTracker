import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";

const prisma = new PrismaClient();

async function main() {
  const cn = "056"; // Abundant Countryside is usually #056 in ECC? Let's check DB.
  const name = "Abundant Countryside";

  console.log("--- Database Check ---");
  // Find by name first to get CN
  const card = await prisma.card.findFirst({
    where: { name: { contains: name } },
    include: { variants: { where: { setCode: "ECC" } } },
  });

  if (card) {
    console.log(`Found Card: ${card.name}`);
    for (const v of card.variants) {
      const prices = await prisma.price.findMany({
        where: { variantId: v.id },
        include: { shop: true },
      });
      console.log(
        `- #${v.collectorNumber} ${v.language} Foil:${v.isFoil} -> Prices: ${prices.length}`,
      );
      prices.forEach((p) => console.log(`   * ${p.shop.name}: ¥${p.priceYen}`));
    }
  } else {
    console.log(`Card "${name}" not found in DB.`);
  }

  console.log("\n--- Hareruya API Check ---");
  // Query with [ECC] to see what we get
  const query = "Abundant Countryside";
  const url = `https://www.hareruyamtg.com/ja/products/search/unisearch_api?kw=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    const docs = json.response?.docs || [];

    console.log(`API returned ${docs.length} docs matching "${query}".`);

    docs.forEach((d: any) => {
      // emulate logic
      const setCode = "ECC";
      const setTag = `[${setCode.toUpperCase()}]`;
      const setTagPrefix = `[${setCode.toUpperCase()}-`;
      const matchesSet =
        d.product_name.includes(setTag) ||
        d.product_name.includes(setTagPrefix);

      console.log(`\nItem: ${d.product_name}`);
      console.log(`  Set Check '[ECC]': ${matchesSet}`);
      console.log(`  Price: ${d.price}`);
    });
  } catch (e) {
    console.error(e);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

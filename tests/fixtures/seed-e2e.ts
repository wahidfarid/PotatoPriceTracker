import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  // Ensure shops exist
  const shops = [
    { name: "Hareruya", url: "https://www.hareruyamtg.com/ja/" },
    { name: "BigMagic", url: "https://www.bigweb.co.jp/" },
    { name: "CardRush", url: "https://www.cardrush-mtg.jp/" },
  ];

  for (const shop of shops) {
    await prisma.shop.upsert({
      where: { name: shop.name },
      update: {},
      create: shop,
    });
  }

  // Upsert test card
  await prisma.card.upsert({
    where: { id: "e2e-card-1" },
    update: {},
    create: {
      id: "e2e-card-1",
      name: "E2E Test Card",
      oracleId: "e2e-oracle-1",
      nameJa: "E2Eテストカード",
    },
  });

  // Upsert test variant
  await prisma.cardVariant.upsert({
    where: { id: "e2e-variant-1" },
    update: {},
    create: {
      id: "e2e-variant-1",
      cardId: "e2e-card-1",
      setCode: "SOS",
      collectorNumber: "999",
      finish: "nonfoil",
      language: "EN",
      scryfallId: null,
      image: null,
    },
  });

  // Find Hareruya shop id
  const hareruya = await prisma.shop.findUniqueOrThrow({
    where: { name: "Hareruya" },
  });

  // Upsert a price entry (no unique constraint on Price — use deleteMany + create for idempotency)
  const existing = await prisma.price.findFirst({
    where: { variantId: "e2e-variant-1", shopId: hareruya.id },
  });

  if (!existing) {
    await prisma.price.create({
      data: {
        variantId: "e2e-variant-1",
        shopId: hareruya.id,
        priceYen: 100,
        buyPriceYen: 50,
        stock: 1,
        sourceUrl: null,
      },
    });
  }

  console.log("E2E seed complete");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

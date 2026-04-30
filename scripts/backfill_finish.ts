import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function backfillFinish() {
  const variants = await prisma.cardVariant.findMany({
    where: { finish: null },
  });

  console.log(`Backfilling finish for ${variants.length} variants...`);

  for (const variant of variants) {
    await prisma.cardVariant.update({
      where: { id: variant.id },
      data: { finish: variant.isFoil ? "foil" : "nonfoil" },
    });
  }

  console.log("Backfill complete.");
}

backfillFinish()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

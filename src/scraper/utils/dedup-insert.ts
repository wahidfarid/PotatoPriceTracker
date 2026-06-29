// src/scraper/utils/dedup-insert.ts — Only insert Price rows that differ from latest
// Replaces prisma.price.createMany() with a version that skips unchanged prices.

import type { PrismaClient } from "@prisma/client";

interface PriceInput {
  variantId: string;
  shopId: string;
  priceYen: number;
  buyPriceYen: number | null;
  stock: number;
  sourceUrl?: string | null;
  sellSourceUrl?: string | null;
}

/**
 * Insert only the Price rows that differ from the latest row per (variantId, shopId).
 * Returns the number of rows actually inserted.
 */
export async function createManyChanged(
  prisma: PrismaClient,
  prices: PriceInput[],
  sourceLabel: string,
): Promise<number> {
  if (prices.length === 0) return 0;

  // Get unique (variantId, shopId) pairs
  const pairs = [
    ...new Set(prices.map((p) => `${p.variantId}|${p.shopId}`)),
  ].map((s) => s.split("|"));

  // Fetch latest price for each pair individually (safe, parameterized)
  const latestMap = new Map<
    string,
    { priceYen: number; buyPriceYen: number | null; stock: number }
  >();

  for (const [variantId, shopId] of pairs) {
    const rows = await prisma.price.findMany({
      where: { variantId, shopId },
      orderBy: { timestamp: "desc" },
      take: 1,
      select: { priceYen: true, buyPriceYen: true, stock: true },
    });
    if (rows.length > 0) {
      latestMap.set(`${variantId}|${shopId}`, rows[0]);
    }
  }

  const changed: typeof prices = [];
  let skipped = 0;

  for (const price of prices) {
    const key = `${price.variantId}|${price.shopId}`;
    const latest = latestMap.get(key);

    if (
      latest &&
      latest.priceYen === price.priceYen &&
      (latest.buyPriceYen === price.buyPriceYen ||
        (latest.buyPriceYen === null && price.buyPriceYen === null)) &&
      latest.stock === price.stock
    ) {
      skipped++;
      continue;
    }
    changed.push(price);
  }

  if (changed.length > 0) {
    await prisma.price.createMany({ data: changed });
  }

  if (skipped > 0) {
    console.log(
      `  [${sourceLabel}] Skipped ${skipped}/${prices.length} unchanged prices`,
    );
  }

  return changed.length;
}

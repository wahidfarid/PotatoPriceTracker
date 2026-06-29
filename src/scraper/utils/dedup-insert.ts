// src/scraper/utils/dedup-insert.ts — Only insert Price rows that differ from latest
// Replaces prisma.price.createMany() with a version that skips unchanged prices.

import type { PrismaClient, Prisma } from "@prisma/client";

interface PriceInput {
  variantId: string;
  shopId: string;
  priceYen: number;
  buyPriceYen: number | null;
  stock: number;
  sourceUrl?: string | null;
  sellSourceUrl?: string | null;
}

type LatestRow = {
  variantId: string;
  shopId: string;
  priceYen: number;
  buyPriceYen: number | null;
  stock: number;
};

/**
 * Insert only the Price rows that differ from the latest row per (variantId, shopId).
 * Uses a single batched raw query to fetch all latest prices, avoiding N+1.
 * Returns the number of rows actually inserted.
 */
export async function createManyChanged(
  prisma: PrismaClient,
  prices: PriceInput[],
  sourceLabel: string,
): Promise<number> {
  if (prices.length === 0) return 0;

  // Build unique (variantId, shopId) pairs for the IN clause
  const pairSet = new Set(prices.map((p) => `${p.variantId}|${p.shopId}`));
  const pairEntries = [...pairSet].map((s) => s.split("|"));

  // Build a VALUES table for the pairs to join against
  // SQLite doesn't support tuple IN with composite keys, so we use a VALUES clause
  const valueRows = pairEntries
    .map(([vid, sid]) => `('${vid}','${sid}')`)
    .join(",\n");

  // Batch fetch: get the latest Price row for each (variantId, shopId) in one query
  const latestRows = valueRows
    ? await prisma.$queryRawUnsafe<LatestRow[]>(`
        WITH pairs(variantId, shopId) AS (
          VALUES ${valueRows}
        ),
        latest AS (
          SELECT p.variantId, p.shopId, p.priceYen, p.buyPriceYen, p.stock,
                 ROW_NUMBER() OVER (
                   PARTITION BY p.variantId, p.shopId
                   ORDER BY p.timestamp DESC
                 ) as rn
          FROM Price p
          JOIN pairs ON p.variantId = pairs.variantId AND p.shopId = pairs.shopId
        )
        SELECT variantId, shopId, priceYen, buyPriceYen, stock
        FROM latest WHERE rn = 1
      `)
    : ([] as LatestRow[]);

  const latestMap = new Map<string, LatestRow>();
  for (const row of latestRows) {
    latestMap.set(`${row.variantId}|${row.shopId}`, row);
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

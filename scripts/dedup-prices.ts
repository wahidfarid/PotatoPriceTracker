// scripts/dedup-prices.ts — Remove consecutive duplicate Price rows
// Deletes rows where (priceYen, buyPriceYen, stock) is identical to the previous
// row for the same (variantId, shopId), keeping the earliest occurrence.
//
// Safety: only processes rows OLDER than 24 hours so the daily scrape is unaffected.
//
// Usage: npx tsx scripts/dedup-prices.ts [--dry-run]

import { createClient } from "@libsql/client";

async function main() {
  const rawUrl = process.env.TURSO_DATABASE_URL;
  if (!rawUrl) throw new Error("TURSO_DATABASE_URL not set");

  const url = rawUrl.replace(/^libsql:/, "https:");
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const dryRun = process.argv.includes("--dry-run");

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Get all (variantId, shopId) pairs
  const pairs = await client.execute(
    "SELECT DISTINCT variantId, shopId FROM Price WHERE timestamp < ?",
    [cutoff],
  );
  console.log(`${pairs.rows.length} (variant, shop) pairs to process...`);

  let totalDeleted = 0;
  let totalKept = 0;

  for (const { variantId, shopId } of pairs.rows) {
    // Get all historical rows for this pair, ordered by time
    const rows = await client.execute({
      sql: `SELECT id, priceYen, buyPriceYen, stock, timestamp 
            FROM Price 
            WHERE variantId = ? AND shopId = ? AND timestamp < ?
            ORDER BY timestamp ASC`,
      args: [variantId, shopId, cutoff],
    });

    if (rows.rows.length < 2) continue;

    // Walk through and mark duplicates (same price/buy/stock as previous)
    const toDelete: string[] = [];
    let prev = rows.rows[0];

    for (let i = 1; i < rows.rows.length; i++) {
      const curr = rows.rows[i];
      if (
        curr.priceYen === prev.priceYen &&
        (curr.buyPriceYen === prev.buyPriceYen ||
          (curr.buyPriceYen === null && prev.buyPriceYen === null)) &&
        curr.stock === prev.stock
      ) {
        toDelete.push(curr.id as string);
      } else {
        prev = curr;
      }
    }

    totalKept += rows.rows.length - toDelete.length;

    if (toDelete.length > 0) {
      if (!dryRun) {
        // Delete in batches of 100
        for (let i = 0; i < toDelete.length; i += 100) {
          const batch = toDelete.slice(i, i + 100);
          const placeholders = batch.map(() => "?").join(",");
          await client.execute({
            sql: `DELETE FROM Price WHERE id IN (${placeholders})`,
            args: batch,
          });
        }
      }
      totalDeleted += toDelete.length;
    }

    if (rows.rows.length > 10) {
      console.log(
        `  ${variantId}/${shopId}: ${rows.rows.length} rows → ${rows.rows.length - toDelete.length} kept (${toDelete.length} dupes removed)`,
      );
    }
  }

  console.log(
    `\n${dryRun ? "[DRY RUN] " : ""}Deleted ${totalDeleted.toLocaleString()} duplicate rows, kept ${totalKept.toLocaleString()}`,
  );

  if (!dryRun) {
    // Vacuum to reclaim space
    console.log("Running VACUUM...");
    await client.execute("VACUUM");
    console.log("Done.");
  }

  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

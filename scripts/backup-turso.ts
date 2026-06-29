// scripts/backup-turso.ts — Backup the Turso database before cleanup
// Usage: npx tsx scripts/backup-turso.ts [output.json.gz]  (default: backup-YYYY-MM-DD.json.gz)

import { createClient } from "@libsql/client";
import { gzipSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const rawUrl = process.env.TURSO_DATABASE_URL;
  if (!rawUrl) throw new Error("TURSO_DATABASE_URL not set");

  const url = rawUrl.replace(/^libsql:/, "https:");
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

  const date = new Date().toISOString().slice(0, 10);
  const outPath = process.argv[2] || `backup-${date}.json.gz`;

  console.log("Backing up tables...");
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  );

  const dump: Record<string, any[]> = {};
  let totalRows = 0;
  for (const { name } of tables.rows) {
    const rows = await client.execute(`SELECT * FROM "${name as string}"`);
    dump[name as string] = rows.rows;
    totalRows += rows.rows.length;
    console.log(`  ${name}: ${rows.rows.length} rows`);
  }

  const json = JSON.stringify(dump);
  const compressed = gzipSync(json);
  writeFileSync(outPath, compressed);
  console.log(
    `Backup saved to ${outPath} (${totalRows.toLocaleString()} rows, ${(compressed.length / 1024).toFixed(0)} KB gzipped)`,
  );
  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// scripts/test-dedup.ts — Specification and confidence tests for dedup logic
// Run: npx tsx scripts/test-dedup.ts
// Verifies the dedup algorithm against a synthetic dataset with known outcomes.

import { createClient } from "@libsql/client";

// ─── Test harness ───────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail ? " — " + detail : ""}`);
  }
}

// ─── Dedup logic (extracted from dedup-prices.ts for testing) ───────────────
interface PriceRow {
  id: string;
  priceYen: number;
  buyPriceYen: number | null;
  stock: number;
}

/**
 * Find consecutive duplicate IDs in a list of Price rows ordered by timestamp ASC.
 * A row is duplicate if priceYen, buyPriceYen, and stock all match the previous row.
 */
function findDupes(rows: PriceRow[]): string[] {
  if (rows.length < 2) return [];
  const dupeIds: string[] = [];
  let prev = rows[0];
  for (let i = 1; i < rows.length; i++) {
    const curr = rows[i];
    if (
      curr.priceYen === prev.priceYen &&
      (curr.buyPriceYen === prev.buyPriceYen ||
        (curr.buyPriceYen === null && prev.buyPriceYen === null)) &&
      curr.stock === prev.stock
    ) {
      dupeIds.push(curr.id);
    } else {
      prev = curr;
    }
  }
  return dupeIds;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

console.log("=== dedup algorithm tests (in-memory) ===\n");

// Test 1: Single row — nothing to dedup
{
  const rows: PriceRow[] = [
    { id: "a", priceYen: 1000, buyPriceYen: 800, stock: 5 },
  ];
  const dupes = findDupes(rows);
  assert("single row — nothing removed", dupes.length === 0);
}

// Test 2: Two identical rows — second is duplicate
{
  const rows: PriceRow[] = [
    { id: "a", priceYen: 1000, buyPriceYen: 800, stock: 5 },
    { id: "b", priceYen: 1000, buyPriceYen: 800, stock: 5 },
  ];
  const dupes = findDupes(rows);
  assert(
    "two identical rows — second removed",
    dupes.length === 1 && dupes[0] === "b",
  );
}

// Test 3: Two different rows — nothing removed
{
  const rows: PriceRow[] = [
    { id: "a", priceYen: 1000, buyPriceYen: 800, stock: 5 },
    { id: "b", priceYen: 1200, buyPriceYen: 800, stock: 5 },
  ];
  const dupes = findDupes(rows);
  assert("different prices — nothing removed", dupes.length === 0);
}

// Test 4: Price changes, then stabilizes — keep transition points
{
  const rows: PriceRow[] = [
    { id: "a", priceYen: 1000, buyPriceYen: 800, stock: 5 },
    { id: "b", priceYen: 1000, buyPriceYen: 800, stock: 5 }, // dupe of a
    { id: "c", priceYen: 1100, buyPriceYen: 800, stock: 5 }, // price changed → keep
    { id: "d", priceYen: 1100, buyPriceYen: 800, stock: 5 }, // dupe of c
    { id: "e", priceYen: 1100, buyPriceYen: 800, stock: 5 }, // dupe of c
    { id: "f", priceYen: 1050, buyPriceYen: 800, stock: 5 }, // price changed → keep
    { id: "g", priceYen: 1050, buyPriceYen: 800, stock: 5 }, // dupe of f
  ];
  const dupes = findDupes(rows);
  assert(
    "stabilize pattern — keep transition points",
    dupes.length === 4 &&
      dupes.includes("b") &&
      dupes.includes("d") &&
      dupes.includes("e") &&
      dupes.includes("g"),
  );
  assert(
    "stabilize pattern — keep a, c, f",
    !dupes.includes("a") && !dupes.includes("c") && !dupes.includes("f"),
  );
}

// Test 5: Stock changes only — keep
{
  const rows: PriceRow[] = [
    { id: "a", priceYen: 1000, buyPriceYen: 800, stock: 5 },
    { id: "b", priceYen: 1000, buyPriceYen: 800, stock: 3 }, // stock changed
  ];
  const dupes = findDupes(rows);
  assert("stock change — keep both", dupes.length === 0);
}

// Test 6: BuyPrice changes only — keep
{
  const rows: PriceRow[] = [
    { id: "a", priceYen: 1000, buyPriceYen: 800, stock: 5 },
    { id: "b", priceYen: 1000, buyPriceYen: 750, stock: 5 }, // buyback changed
  ];
  const dupes = findDupes(rows);
  assert("buyPriceYen change — keep both", dupes.length === 0);
}

// Test 7: null buyPriceYen equality
{
  const rows: PriceRow[] = [
    { id: "a", priceYen: 1000, buyPriceYen: null, stock: 5 },
    { id: "b", priceYen: 1000, buyPriceYen: null, stock: 5 }, // both null → dupe
  ];
  const dupes = findDupes(rows);
  assert(
    "null buyPriceYen match — second removed",
    dupes.length === 1 && dupes[0] === "b",
  );
}

// Test 8: null → non-null buyPriceYen — keep (it changed)
{
  const rows: PriceRow[] = [
    { id: "a", priceYen: 1000, buyPriceYen: null, stock: 5 },
    { id: "b", priceYen: 1000, buyPriceYen: 800, stock: 5 }, // null → value
  ];
  const dupes = findDupes(rows);
  assert("null → non-null buyPrice — keep both", dupes.length === 0);
}

// Test 9: Regresssion after change — keep all
// Day 1: $1000, Day 2: $1200, Day 3: $1000 again. Day 3 is NOT a dupe of Day 1
// because Day 3 is compared to Day 2 (consecutive only).
{
  const rows: PriceRow[] = [
    { id: "a", priceYen: 1000, buyPriceYen: 800, stock: 5 },
    { id: "b", priceYen: 1200, buyPriceYen: 800, stock: 5 }, // changed
    { id: "c", priceYen: 1000, buyPriceYen: 800, stock: 5 }, // back to same as a
  ];
  const dupes = findDupes(rows);
  assert(
    "regression to previous price — keep all (consecutive only)",
    dupes.length === 0,
  );
}

// Test 10: All columns change
{
  const rows: PriceRow[] = [
    { id: "a", priceYen: 1000, buyPriceYen: 800, stock: 5 },
    { id: "b", priceYen: 1200, buyPriceYen: 900, stock: 10 }, // all changed
  ];
  const dupes = findDupes(rows);
  assert("all columns change — keep both", dupes.length === 0);
}

// ─── Results ────────────────────────────────────────────────────────────────
console.log(
  `\n${passed} passed, ${failed} failed out of ${passed + failed} tests`,
);

if (failed > 0) {
  process.exit(1);
}

console.log("\n=== confidence: all algorithm invariants hold ===");

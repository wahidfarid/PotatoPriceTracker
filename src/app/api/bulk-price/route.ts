import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/data";
import type {
  ParsedLine,
  ResolvedRow,
  ShopPrice,
  VariantInfo,
} from "@/lib/bulk-parser";

// Mirrors dashboard SETS order — used as tiebreaker when multiple variants match a name
const SET_ORDER = [
  "SOS",
  "SOC",
  "SOA",
  "ECL",
  "ECC",
  "SPG",
  "TMT",
  "TMC",
  "PZA",
];

type RawVariant = Awaited<
  ReturnType<typeof prisma.cardVariant.findMany>
>[number] & {
  card: { id: string; name: string; nameJa: string | null };
};

type RawPriceRow = {
  variantId: string;
  shopName: string;
  priceYen: number;
  buyPriceYen: number | null;
  stock: number;
  sourceUrl: string | null;
  sellSourceUrl: string | null;
  timestamp: bigint | string;
};

function buildVariantInfo(
  v: RawVariant,
  priceMap: Map<string, Map<string, ShopPrice>>,
): VariantInfo {
  return {
    id: v.id,
    setCode: v.setCode,
    collectorNumber: v.collectorNumber,
    finish: v.finish,
    language: v.language,
    scryfallId: v.scryfallId ?? null,
    prices: priceMap.has(v.id) ? Array.from(priceMap.get(v.id)!.values()) : [],
  };
}

export async function POST(req: Request) {
  let body: { lines: ParsedLine[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const lines: ParsedLine[] = body?.lines ?? [];
  if (!Array.isArray(lines)) {
    return NextResponse.json(
      { error: "lines must be an array" },
      { status: 400 },
    );
  }
  if (lines.length > 1000) {
    return NextResponse.json(
      { error: "Too many lines (max 1000)" },
      { status: 413 },
    );
  }
  if (lines.length === 0) {
    return NextResponse.json({ rows: [] });
  }

  // ── Query 1: all variants with their card (no prices) ──────────────────────
  const allVariants = (await prisma.cardVariant.findMany({
    include: { card: { select: { id: true, name: true, nameJa: true } } },
  })) as RawVariant[];

  // ── Match each parsed line to candidate variants ────────────────────────────
  type LineMatch = {
    line: ParsedLine;
    candidates: RawVariant[];
    fallbackNote: ResolvedRow["fallbackNote"];
    tokenLocked: boolean;
  };

  const lineMatches: LineMatch[] = [];
  const candidateIds = new Set<string>();

  for (const line of lines) {
    let candidates: RawVariant[];
    let fallbackNote: ResolvedRow["fallbackNote"] = null;
    let tokenLocked = false;

    if (line.setCode && line.collectorNumber) {
      // Token-supplied: narrow by (setCode, CN) exactly
      tokenLocked = true;
      const pool = allVariants.filter(
        (v) =>
          v.setCode === line.setCode &&
          v.collectorNumber === line.collectorNumber,
      );

      if (pool.length === 0) {
        candidates = [];
      } else if (line.foil) {
        const foils = pool.filter((v) => v.finish !== "nonfoil");
        if (foils.length > 0) {
          candidates = foils;
        } else {
          candidates = pool;
          fallbackNote = "no_foil_tracked";
        }
      } else {
        const nonfoils = pool.filter((v) => v.finish === "nonfoil");
        if (nonfoils.length > 0) {
          candidates = nonfoils;
        } else {
          candidates = pool;
          fallbackNote = "no_nonfoil_tracked";
        }
      }

      // Prefer requested language; fall back to the full pool if none match
      const preferredLang = line.language ?? "EN";
      const langFiltered = candidates.filter(
        (v) => v.language === preferredLang,
      );
      if (langFiltered.length > 0) candidates = langFiltered;
    } else {
      // Name-only: case-insensitive match against name or nameJa
      const nameLower = line.name.toLowerCase();
      candidates = allVariants.filter(
        (v) =>
          v.card.name.toLowerCase() === nameLower ||
          (v.card.nameJa !== null && v.card.nameJa.toLowerCase() === nameLower),
      );
    }

    candidates.forEach((v) => candidateIds.add(v.id));
    lineMatches.push({ line, candidates, fallbackNote, tokenLocked });
  }

  // ── Query 2: all price rows for matched variants, dedup to latest in JS ──────
  // Simple IN-list scan using the existing variantId index. Deduplication in JS
  // is fast; keeping the query flat avoids complex subquery plans on Turso.
  const priceMap = new Map<string, Map<string, ShopPrice>>();
  const tsMap = new Map<string, Map<string, number>>(); // variantId → shopName → latestMs

  if (candidateIds.size > 0) {
    const ids = Array.from(candidateIds);

    const rawPrices = await prisma.$queryRaw<RawPriceRow[]>`
      SELECT p.variantId, s.name as shopName, p.priceYen, p.buyPriceYen, p.stock,
             p.sourceUrl, p.sellSourceUrl, p.timestamp
      FROM Price p
      JOIN Shop s ON s.id = p.shopId
      WHERE p.variantId IN (${Prisma.join(ids)})
        AND (p.priceYen > 0 OR p.buyPriceYen > 0)
    `;

    for (const p of rawPrices) {
      const ms =
        typeof p.timestamp === "string"
          ? new Date(p.timestamp).getTime()
          : Number(p.timestamp);

      if (!tsMap.has(p.variantId)) tsMap.set(p.variantId, new Map());
      const prevMs = tsMap.get(p.variantId)!.get(p.shopName) ?? -1;

      if (ms > prevMs) {
        tsMap.get(p.variantId)!.set(p.shopName, ms);
        if (!priceMap.has(p.variantId)) priceMap.set(p.variantId, new Map());
        priceMap.get(p.variantId)!.set(p.shopName, {
          shopName: p.shopName,
          priceYen: p.priceYen,
          buyPriceYen: p.buyPriceYen ?? null,
          stock: p.stock,
          sourceUrl: p.sourceUrl ?? null,
          sellSourceUrl: p.sellSourceUrl ?? null,
        });
      }
    }
  }

  // ── Build result rows (merge sideboard duplicates) ──────────────────────────
  const mergedRows = new Map<string, ResolvedRow>();

  for (const { line, candidates, fallbackNote, tokenLocked } of lineMatches) {
    if (candidates.length === 0) {
      const key = `notfound-${line.name}`;
      const existing = mergedRows.get(key);
      if (existing) {
        existing.qty += line.qty;
      } else {
        mergedRows.set(key, {
          key,
          qty: line.qty,
          cardName: line.name,
          cardNameJa: null,
          variant: null,
          alternates: [],
          fallbackNote: null,
          notFound: true,
        });
      }
      continue;
    }

    // Determine default variant
    let defaultVariant: RawVariant;

    if (tokenLocked) {
      defaultVariant = candidates[0];
    } else {
      // Tiebreaker: preferred language → nonfoil → cheapest Hareruya → earliest SET_ORDER
      const preferredLang = line.language ?? "EN";
      const langPool = candidates.filter((v) => v.language === preferredLang);
      const langFiltered = langPool.length > 0 ? langPool : candidates;
      const nonfoils = langFiltered.filter((v) => v.finish === "nonfoil");
      const pool = nonfoils.length > 0 ? nonfoils : langFiltered;

      defaultVariant = pool.slice().sort((a, b) => {
        const pa = priceMap.get(a.id)?.get("Hareruya")?.priceYen ?? Infinity;
        const pb = priceMap.get(b.id)?.get("Hareruya")?.priceYen ?? Infinity;
        if (pa !== pb) return pa - pb;
        const oa = SET_ORDER.indexOf(a.setCode);
        const ob = SET_ORDER.indexOf(b.setCode);
        return (oa === -1 ? 999 : oa) - (ob === -1 ? 999 : ob);
      })[0];
    }

    const key = defaultVariant.id;
    const existing = mergedRows.get(key);

    if (existing) {
      existing.qty += line.qty;
    } else {
      mergedRows.set(key, {
        key,
        qty: line.qty,
        cardName: defaultVariant.card.name,
        cardNameJa: defaultVariant.card.nameJa ?? null,
        variant: buildVariantInfo(defaultVariant, priceMap),
        alternates: candidates
          .filter((v) => v.id !== defaultVariant.id)
          .map((v) => buildVariantInfo(v, priceMap)),
        fallbackNote,
        notFound: false,
      });
    }
  }

  // ── Sort: maxKaitori×qty DESC, name ASC, notFound pinned last ───────────────
  function maxKaitoriTimesQty(row: ResolvedRow): number {
    if (!row.variant) return 0;
    const allVariants = [row.variant, ...row.alternates];
    let max = 0;
    for (const v of allVariants) {
      for (const p of v.prices) {
        if (p.buyPriceYen && p.buyPriceYen > max) max = p.buyPriceYen;
      }
    }
    return max * row.qty;
  }

  const rows = Array.from(mergedRows.values()).sort((a, b) => {
    if (a.notFound !== b.notFound) return a.notFound ? 1 : -1;
    const diff = maxKaitoriTimesQty(b) - maxKaitoriTimesQty(a);
    if (diff !== 0) return diff;
    return a.cardName.localeCompare(b.cardName);
  });

  return NextResponse.json({ rows });
}

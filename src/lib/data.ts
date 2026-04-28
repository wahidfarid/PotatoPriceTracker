import { gzip, gunzip } from "node:zlib";
import { promisify } from "node:util";
import { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export { prisma };

const DEFAULT_SET = "SOS";

type LatestPrice = {
  variantId: string;
  shopName: string;
  priceYen: number;
  buyPriceYen: number | null;
  stock: number;
  sourceUrl: string | null;
  sellSourceUrl: string | null;
  timestamp: bigint | string;
};

async function _getDashboardData(setCode: string) {
  const cards = await prisma.card.findMany({
    where: {
      variants: {
        some: { setCode },
      },
    },
    include: {
      variants: {
        where: { setCode },
        orderBy: [{ collectorNumber: "asc" }, { finish: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  const variantIds = cards.flatMap((card) => card.variants.map((v) => v.id));

  // Attach empty prices so CardList never sees undefined
  cards.forEach((card) => {
    card.variants.forEach((variant) => {
      (variant as any).prices = [];
    });
  });

  if (variantIds.length === 0) {
    return { cards, lastUpdated: null };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Run all three flat queries in parallel — no correlated subqueries
  const [allPrices, sparklinePrices, latestPrice] = await Promise.all([
    // Latest price per (variant, shop): flat IN-list, dedup in JS
    prisma.$queryRaw<LatestPrice[]>`
      SELECT p.variantId, s.name as shopName, p.priceYen, p.buyPriceYen,
             p.stock, p.sourceUrl, p.sellSourceUrl, p.timestamp
      FROM Price p
      JOIN Shop s ON s.id = p.shopId
      WHERE p.variantId IN (${Prisma.join(variantIds)})
    `,
    // Sparkline data — last 30 days
    prisma.$queryRaw<
      Array<{
        variantId: string;
        timestamp: bigint | string;
        priceYen: number;
        buyPriceYen: number | null;
        shopName: string;
      }>
    >`
      SELECT p.variantId, p.timestamp, p.priceYen, p.buyPriceYen, s.name as shopName
      FROM Price p
      JOIN Shop s ON p.shopId = s.id
      WHERE p.variantId IN (${Prisma.join(variantIds)})
        AND p.timestamp >= ${thirtyDaysAgo.toISOString()}
        AND p.priceYen > 0
      ORDER BY p.timestamp ASC
    `,
    prisma.$queryRaw<
      [{ maxTs: bigint | string | null }]
    >`SELECT MAX(timestamp) as maxTs FROM Price`,
  ]);

  // ── Stitch latest prices into variants ────────────────────────────────────
  const latestPriceMap = new Map<string, Map<string, LatestPrice>>();
  for (const p of allPrices) {
    if (!latestPriceMap.has(p.variantId))
      latestPriceMap.set(p.variantId, new Map());
    const shopMap = latestPriceMap.get(p.variantId)!;
    const existing = shopMap.get(p.shopName);
    if (!existing) {
      shopMap.set(p.shopName, p);
    } else {
      const existTs =
        typeof existing.timestamp === "string"
          ? new Date(existing.timestamp).getTime()
          : Number(existing.timestamp);
      const curTs =
        typeof p.timestamp === "string"
          ? new Date(p.timestamp).getTime()
          : Number(p.timestamp);
      if (curTs > existTs) shopMap.set(p.shopName, p);
    }
  }

  cards.forEach((card) => {
    card.variants.forEach((variant) => {
      const shopMap = latestPriceMap.get(variant.id);
      (variant as any).prices = shopMap
        ? Array.from(shopMap.values()).map((p) => ({
            priceYen: p.priceYen,
            buyPriceYen: p.buyPriceYen,
            stock: p.stock,
            sourceUrl: p.sourceUrl,
            sellSourceUrl: p.sellSourceUrl,
            shop: { name: p.shopName },
          }))
        : [];
    });
  });

  // ── lastUpdated ────────────────────────────────────────────────────────────
  const maxTs = latestPrice[0]?.maxTs;
  let lastUpdated: string | null = null;
  if (maxTs) {
    const ts =
      typeof maxTs === "string" ? new Date(maxTs) : new Date(Number(maxTs));
    lastUpdated = ts.toISOString();
  }

  // ── Sparkline data — process sparklinePrices from Promise.all above ─────────
  try {
    const shopDayMap = new Map<
      string,
      {
        variantId: string;
        dayKey: string;
        ts: number;
        priceYen: number;
        buyPriceYen: number | null;
      }
    >();

    sparklinePrices.forEach((price) => {
      try {
        const ts = price.timestamp;
        const date =
          typeof ts === "string" ? new Date(ts) : new Date(Number(ts));
        const timestampMs = date.getTime();
        const dayKey = format(date, "yyyy-MM-dd");
        const key = `${price.variantId}-${dayKey}-${price.shopName}`;
        const existing = shopDayMap.get(key);
        if (!existing || timestampMs > existing.ts) {
          shopDayMap.set(key, {
            variantId: price.variantId,
            dayKey,
            ts: timestampMs,
            priceYen: price.priceYen,
            buyPriceYen: price.buyPriceYen,
          });
        }
      } catch {
        console.warn("Skipping sparkline price with invalid timestamp:", price);
      }
    });

    const variantDayMap = new Map<
      string,
      {
        variantId: string;
        dayKey: string;
        sellPrices: number[];
        buyPrices: number[];
      }
    >();
    shopDayMap.forEach((data) => {
      const key = `${data.variantId}-${data.dayKey}`;
      if (!variantDayMap.has(key)) {
        variantDayMap.set(key, {
          variantId: data.variantId,
          dayKey: data.dayKey,
          sellPrices: [],
          buyPrices: [],
        });
      }
      const entry = variantDayMap.get(key)!;
      if (data.priceYen > 0) entry.sellPrices.push(data.priceYen);
      if (data.buyPriceYen && data.buyPriceYen > 0)
        entry.buyPrices.push(data.buyPriceYen);
    });

    const variantBuySparklines = new Map<
      string,
      { dayKey: string; price: number }[]
    >();
    const variantSellSparklines = new Map<
      string,
      { dayKey: string; price: number }[]
    >();

    variantDayMap.forEach((data) => {
      if (!variantBuySparklines.has(data.variantId)) {
        variantBuySparklines.set(data.variantId, []);
        variantSellSparklines.set(data.variantId, []);
      }
      if (data.sellPrices.length > 0) {
        const avg =
          data.sellPrices.reduce((a, b) => a + b, 0) / data.sellPrices.length;
        variantBuySparklines
          .get(data.variantId)!
          .push({ dayKey: data.dayKey, price: avg });
      }
      if (data.buyPrices.length > 0) {
        const avg =
          data.buyPrices.reduce((a, b) => a + b, 0) / data.buyPrices.length;
        variantSellSparklines
          .get(data.variantId)!
          .push({ dayKey: data.dayKey, price: avg });
      }
    });

    const sortAndLimit = (arr: { dayKey: string; price: number }[]) =>
      arr.sort((a, b) => a.dayKey.localeCompare(b.dayKey)).slice(-30);

    variantBuySparklines.forEach((points, id) =>
      variantBuySparklines.set(id, sortAndLimit(points)),
    );
    variantSellSparklines.forEach((points, id) =>
      variantSellSparklines.set(id, sortAndLimit(points)),
    );

    cards.forEach((card) => {
      card.variants.forEach((variant) => {
        (variant as any).sparklineBuyData = (
          variantBuySparklines.get(variant.id) || []
        ).map((p) => ({ price: p.price, timestamp: p.dayKey }));
        (variant as any).sparklineSellData = (
          variantSellSparklines.get(variant.id) || []
        ).map((p) => ({ price: p.price, timestamp: p.dayKey }));
      });
    });
  } catch (error) {
    console.error("Error processing sparkline data:", error);
    cards.forEach((card) => {
      card.variants.forEach((variant) => {
        (variant as any).sparklineBuyData = [];
        (variant as any).sparklineSellData = [];
      });
    });
  }

  return { cards, lastUpdated };
}

async function _getDashboardDataCompressed(setCode: string): Promise<string> {
  const data = await _getDashboardData(setCode);
  const json = JSON.stringify(data);
  const compressed = await gzipAsync(json);
  return compressed.toString("base64");
}

export async function getDashboardData(setCode?: string) {
  const set = setCode || DEFAULT_SET;
  const b64 = await unstable_cache(
    () => _getDashboardDataCompressed(set),
    ["dashboard-data", set],
    { revalidate: 86400, tags: ["dashboard-data"] },
  )();
  const decompressed = await gunzipAsync(Buffer.from(b64, "base64"));
  return JSON.parse(decompressed.toString("utf8")) as Awaited<
    ReturnType<typeof _getDashboardData>
  >;
}

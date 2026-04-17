import { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";

export { prisma };

async function _getDashboardData() {
  // Fetch details for cards that have at least one variant? Or all cards in the set?
  // We seeded all cards.
  // We want to show cards.
  const cards = await prisma.card.findMany({
    where: {
      variants: {
        some: {}, // Only show cards that have at least one tracked variant
      },
    },
    include: {
      variants: {
        include: {
          prices: {
            orderBy: { timestamp: "desc" },
            take: 3,
            include: { shop: true },
          },
        },
        orderBy: [{ collectorNumber: "asc" }, { finish: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  // Fetch sparkline data for all variants in one query
  // Wrap in try-catch so page still loads if this fails
  try {
    const variantIds = cards.flatMap((card) => card.variants.map((v) => v.id));
    if (variantIds.length > 0) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Fetch all prices for sparklines (last 30 days)
      // Turso returns timestamps as ISO strings; SQLite as integer ms.
      // Compare using both formats so the filter works on either backend.
      const thirtyDaysAgoMs = thirtyDaysAgo.getTime();
      const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();

      const allPrices = await prisma.$queryRaw<
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
                  AND p.timestamp >= ${thirtyDaysAgoIso}
                  AND p.priceYen > 0
                ORDER BY p.timestamp ASC
            `;

      // Step 1: Group by variantId-dayKey-shopName, keep last entry per shop per day
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

      allPrices.forEach((price) => {
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
        } catch (e) {
          console.warn("Skipping price with invalid timestamp:", price);
        }
      });

      // Step 2: Aggregate per variantId-dayKey across shops
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

      // Step 3: Build per-variant sparkline arrays (sorted, last 30 days)
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

      // Attach sparkline data to variants
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
    }
  } catch (error) {
    // If sparkline data fetching fails, just continue without it
    console.error("Error fetching sparkline data:", error);
    // Initialize empty sparklineData for all variants
    cards.forEach((card) => {
      card.variants.forEach((variant) => {
        (variant as any).sparklineBuyData = [];
        (variant as any).sparklineSellData = [];
      });
    });
  }

  const latestPrice = await prisma.$queryRaw<
    [{ maxTs: bigint | string | null }]
  >`
        SELECT MAX(timestamp) as maxTs FROM Price
    `;
  const maxTs = latestPrice[0]?.maxTs;
  let lastUpdated: string | null = null;
  if (maxTs) {
    const ts =
      typeof maxTs === "string" ? new Date(maxTs) : new Date(Number(maxTs));
    lastUpdated = ts.toISOString();
  }

  return { cards, lastUpdated };
}

export const getDashboardData = unstable_cache(
  _getDashboardData,
  ["dashboard-data"],
  { revalidate: 86400, tags: ["dashboard-data"] },
);

import { NextResponse } from "next/server";
import { prisma } from "@/lib/data";
import { format } from "date-fns";

export const revalidate = 86400;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> | { cardId: string } },
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const cardId = resolvedParams.cardId;

    if (!cardId || cardId.length > 64) {
      return NextResponse.json({ error: "Invalid card ID" }, { status: 400 });
    }

    // Get all variants for this card
    const variants = await prisma.cardVariant.findMany({
      where: { cardId },
      select: { id: true },
    });

    if (variants.length === 0) {
      return NextResponse.json({});
    }

    const variantIds = variants.map((v) => v.id);
    const averagesParam = request.url.includes("averages=true");

    // Fetch all prices for all variants in one query
    const prices = await prisma.price.findMany({
      where: {
        variantId: {
          in: variantIds,
        },
      },
      include: { shop: true },
      orderBy: { timestamp: "asc" },
    });

    const result: Record<string, any> = {};

    // Group prices by variant
    const pricesByVariant = new Map<string, typeof prices>();
    prices.forEach((price) => {
      if (!pricesByVariant.has(price.variantId)) {
        pricesByVariant.set(price.variantId, []);
      }
      pricesByVariant.get(price.variantId)!.push(price);
    });

    // For each variant, group by day and format
    pricesByVariant.forEach((variantPrices, variantId) => {
      const dailyPrices = new Map<string, (typeof variantPrices)[0]>();

      variantPrices.forEach((price) => {
        const dayKey = format(new Date(price.timestamp), "yyyy-MM-dd");
        const shopDayKey = price.shop
          ? `${dayKey}-${price.shop.name}`
          : `deleted-shop-${dayKey}`;
        const existing = dailyPrices.get(shopDayKey);
        if (
          !existing ||
          new Date(price.timestamp) > new Date(existing.timestamp)
        ) {
          dailyPrices.set(shopDayKey, price);
        }
      });

      const pricesData = Array.from(dailyPrices.values())
        .map((p) => ({
          timestamp: p.timestamp.toISOString(),
          priceYen: p.priceYen,
          buyPriceYen: p.buyPriceYen,
          shopName: p.shop?.name || "Unknown",
        }))
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );

      if (averagesParam) {
        const dailyAverages = Object.values(
          Array.from(dailyPrices.values()).reduce(
            (acc, p) => {
              const dayKey = format(new Date(p.timestamp), "yyyy-MM-dd");
              if (!acc[dayKey]) {
                acc[dayKey] = {
                  totalYen: 0,
                  count: 0,
                  timestamp: p.timestamp.toISOString(),
                };
              }
              acc[dayKey].totalYen += p.priceYen;
              acc[dayKey].count += 1;
              return acc;
            },
            {} as Record<
              string,
              { totalYen: number; count: number; timestamp: string }
            >,
          ),
        )
          .map((group) => ({
            timestamp: group.timestamp,
            priceYen: group.totalYen / group.count,
          }))
          .sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          );

        result[variantId] = { prices: pricesData, dailyAverages };
      } else {
        result[variantId] = { prices: pricesData, dailyAverages: [] };
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching batch price history:", error);
    return NextResponse.json(
      { error: "Failed to fetch price history" },
      { status: 500 },
    );
  }
}

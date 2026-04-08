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

    // Get all variants for this card
    const variants = await prisma.cardVariant.findMany({
      where: { cardId },
      select: { id: true },
    });

    if (variants.length === 0) {
      return NextResponse.json({});
    }

    const variantIds = variants.map((v) => v.id);

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

    // Group prices by variant, then by day (keeping last price per day)
    const result: Record<
      string,
      Array<{
        timestamp: string;
        priceYen: number;
        buyPriceYen: number | null;
        shopName: string;
      }>
    > = {};

    // Initialize result object for each variant
    variantIds.forEach((variantId) => {
      result[variantId] = [];
    });

    // Group by variant
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
        const shopDayKey = `${dayKey}-${price.shop.name}`;
        const existing = dailyPrices.get(shopDayKey);
        if (
          !existing ||
          new Date(price.timestamp) > new Date(existing.timestamp)
        ) {
          dailyPrices.set(shopDayKey, price);
        }
      });

      result[variantId] = Array.from(dailyPrices.values())
        .map((p) => ({
          timestamp: p.timestamp.toISOString(),
          priceYen: p.priceYen,
          buyPriceYen: p.buyPriceYen,
          shopName: p.shop.name,
        }))
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
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

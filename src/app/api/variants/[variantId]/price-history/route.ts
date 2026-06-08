import { NextResponse } from "next/server";
import { prisma } from "@/lib/data";
import { format } from "date-fns";

export const revalidate = 86400;

export async function GET(
  request: Request,
  {
    params,
  }: { params: Promise<{ variantId: string }> | { variantId: string } },
) {
  const resolvedParams = await Promise.resolve(params);
  const variantId = resolvedParams.variantId;

  if (!variantId || variantId.length > 64) {
    return NextResponse.json({ error: "Invalid variant ID" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const sparkline = searchParams.get("sparkline") === "true";
  const averages = searchParams.get("averages") === "true";

  const prices = await prisma.price.findMany({
    where: { variantId },
    include: { shop: true },
    orderBy: { timestamp: "asc" },
  });

  // Group by day, keeping last price per day
  const dailyPrices = new Map<string, (typeof prices)[0]>();
  prices.forEach((price) => {
    const dayKey = format(new Date(price.timestamp), "yyyy-MM-dd");
    const shopDayKey = `${dayKey}-${price.shop.name}`;
    const existing = dailyPrices.get(shopDayKey);
    if (!existing || new Date(price.timestamp) > new Date(existing.timestamp)) {
      dailyPrices.set(shopDayKey, price);
    }
  });

  let result = Array.from(dailyPrices.values())
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

  if (sparkline) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    result = result
      .filter((p) => new Date(p.timestamp) >= thirtyDaysAgo)
      .slice(-30);
  }

  if (averages) {
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

    if (sparkline) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const filteredAverages = dailyAverages.filter(
        (p) => new Date(p.timestamp) >= thirtyDaysAgo,
      );
      return NextResponse.json({
        prices: result,
        dailyAverages: filteredAverages.slice(-30),
      });
    }

    return NextResponse.json({ prices: result, dailyAverages });
  }

  return NextResponse.json(result);
}

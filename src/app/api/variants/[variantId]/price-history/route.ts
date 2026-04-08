import { NextResponse } from 'next/server';
import { prisma } from '@/lib/data';
import { format } from 'date-fns';

export const revalidate = 86400;

export async function GET(
    request: Request,
    { params }: { params: Promise<{ variantId: string }> | { variantId: string } }
) {
    const resolvedParams = await Promise.resolve(params);
    const variantId = resolvedParams.variantId;
    const { searchParams } = new URL(request.url);
    const sparkline = searchParams.get('sparkline') === 'true';
    
    const prices = await prisma.price.findMany({
        where: { variantId },
        include: { shop: true },
        orderBy: { timestamp: 'asc' }
    });

    // Group by day, keeping last price per day
    const dailyPrices = new Map<string, typeof prices[0]>();
    prices.forEach(price => {
        const dayKey = format(new Date(price.timestamp), 'yyyy-MM-dd');
        const shopDayKey = `${dayKey}-${price.shop.name}`;
        const existing = dailyPrices.get(shopDayKey);
        if (!existing || new Date(price.timestamp) > new Date(existing.timestamp)) {
            dailyPrices.set(shopDayKey, price);
        }
    });

    let result = Array.from(dailyPrices.values())
        .map(p => ({
            timestamp: p.timestamp.toISOString(),
            priceYen: p.priceYen,
            buyPriceYen: p.buyPriceYen,
            shopName: p.shop.name
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // For sparklines, limit to last 30 days or last 30 data points (whichever is smaller)
    if (sparkline) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        result = result
            .filter(p => new Date(p.timestamp) >= thirtyDaysAgo)
            .slice(-30); // Take last 30 points max
    }

    return NextResponse.json(result);
}

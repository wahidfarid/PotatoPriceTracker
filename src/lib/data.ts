import { PrismaClient, Prisma } from '@prisma/client';
import path from 'path';
import { format } from 'date-fns';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Ensure the DB path is absolute and correct for Vercel's serverless environment
if (process.env.NODE_ENV === 'production') {
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
    process.env.DATABASE_URL = `file:${dbPath}`;
}

export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function getDashboardData() {
    // Fetch details for cards that have at least one variant? Or all cards in the set?
    // We seeded all cards.
    // We want to show cards.
    const cards = await prisma.card.findMany({
        where: {
            variants: {
                some: {} // Only show cards that have at least one tracked variant
            }
        },
        include: {
            variants: {
                include: {
                    prices: {
                        orderBy: { timestamp: 'desc' },
                        take: 10, // Get latest prices from multiple shops
                        include: { shop: true }
                    }
                },
                orderBy: { collectorNumber: 'asc' }
            }
        },
        orderBy: { name: 'asc' }
    });

    // Fetch sparkline data for all variants in one query
    // Wrap in try-catch so page still loads if this fails
    try {
        const variantIds = cards.flatMap(card => card.variants.map(v => v.id));
        
        if (variantIds.length > 0) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            // Fetch all prices for sparklines (last 30 days) - limit to avoid huge queries
            // Use select to only get what we need
            // Note: timestamps are stored as Unix milliseconds (integers) in SQLite,
            // so we need to compare with milliseconds, not Date objects
            const thirtyDaysAgoMs = thirtyDaysAgo.getTime();

            const allPrices = await prisma.$queryRaw<Array<{
                variantId: string;
                timestamp: bigint;
                priceYen: number;
                shopName: string;
            }>>`
                SELECT p.variantId, p.timestamp, p.priceYen, s.name as shopName
                FROM Price p
                JOIN Shop s ON p.shopId = s.id
                WHERE p.variantId IN (${Prisma.join(variantIds)})
                  AND p.timestamp >= ${thirtyDaysAgoMs}
                  AND p.priceYen > 0
                ORDER BY p.timestamp ASC
                LIMIT 10000
            `;

        // Group by variant and day, keeping last price per day
        const sparklineDataMap = new Map<string, any>();
        
        allPrices.forEach(price => {
            try {
                // Convert bigint timestamp to Date
                const timestampMs = Number(price.timestamp);
                const dayKey = format(new Date(timestampMs), 'yyyy-MM-dd');
                const key = `${price.variantId}-${dayKey}`;

                if (!sparklineDataMap.has(key)) {
                    sparklineDataMap.set(key, {
                        variantId: price.variantId,
                        dayKey,
                        timestamp: new Date(timestampMs),
                        priceYen: price.priceYen,
                        shopName: price.shopName
                    });
                } else {
                    const existing = sparklineDataMap.get(key)!;
                    // Keep the last price of the day
                    if (timestampMs > new Date(existing.timestamp).getTime()) {
                        sparklineDataMap.set(key, {
                            variantId: price.variantId,
                            dayKey,
                            timestamp: new Date(timestampMs),
                            priceYen: price.priceYen,
                            shopName: price.shopName
                        });
                    }
                }
            } catch (e) {
                // Skip invalid dates
                console.warn('Skipping price with invalid timestamp:', price);
            }
        });

        // Group by variant and limit to last 30 points
        const variantSparklines = new Map<string, any[]>();
        sparklineDataMap.forEach((data) => {
            const variantId = data.variantId;
            if (!variantSparklines.has(variantId)) {
                variantSparklines.set(variantId, []);
            }
            variantSparklines.get(variantId)!.push(data);
        });

        // Sort and limit each variant's data
        variantSparklines.forEach((prices, variantId) => {
            const sorted = prices
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .slice(-30); // Last 30 points max
            variantSparklines.set(variantId, sorted);
        });

        // Attach sparkline data to variants
        cards.forEach(card => {
            card.variants.forEach(variant => {
                const sparklineData = variantSparklines.get(variant.id) || [];
                // Get Hareruya prices if available, otherwise use first shop
                const hareruyaData = sparklineData.filter((p: any) => p.shopName === 'Hareruya');
                const finalData = (hareruyaData.length > 0 ? hareruyaData : sparklineData)
                    .map((p: any) => ({
                        price: p.priceYen,
                        timestamp: p.timestamp.toISOString()
                    }));

                (variant as any).sparklineData = finalData;
            });
        });
        }
    } catch (error) {
        // If sparkline data fetching fails, just continue without it
        console.error('Error fetching sparkline data:', error);
        // Initialize empty sparklineData for all variants
        cards.forEach(card => {
            card.variants.forEach(variant => {
                (variant as any).sparklineData = [];
            });
        });
    }

    return cards;
}


import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
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
                        take: 1,
                        include: { shop: true }
                    }
                },
                orderBy: { collectorNumber: 'asc' }
            }
        },
        orderBy: { name: 'asc' }
    });

    return cards;
}

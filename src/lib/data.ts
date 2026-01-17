import { PrismaClient } from '@prisma/client';
import path from 'path';

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

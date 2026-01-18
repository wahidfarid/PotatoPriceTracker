import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyKaitoriData() {
    console.log('=== Hareruya Kaitori Data Verification ===\n');

    const shop = await prisma.shop.findUnique({ where: { name: 'Hareruya' } });
    if (!shop) {
        console.error('Hareruya shop not found in database');
        return;
    }

    const latestPrices = await prisma.$queryRaw<Array<{
        variantId: string;
        setCode: string;
        buyPriceYen: number | null;
        sellSourceUrl: string | null;
        timestamp: number;
    }>>`
        WITH LatestPrices AS (
            SELECT 
                p.variantId,
                p.buyPriceYen,
                p.sellSourceUrl,
                p.timestamp,
                cv.setCode,
                ROW_NUMBER() OVER (PARTITION BY p.variantId ORDER BY p.timestamp DESC) as rn
            FROM Price p
            JOIN CardVariant cv ON p.variantId = cv.id
            WHERE p.shopId = ${shop.id}
        )
        SELECT variantId, setCode, buyPriceYen, sellSourceUrl, timestamp
        FROM LatestPrices
        WHERE rn = 1
    `;

    const totalWithBuyPrice = latestPrices.filter(p => p.buyPriceYen !== null).length;
    const totalWithUrl = latestPrices.filter(p => p.buyPriceYen !== null && p.sellSourceUrl !== null).length;
    const urlCoverage = totalWithBuyPrice > 0 ? ((totalWithUrl / totalWithBuyPrice) * 100).toFixed(2) : '0.00';

    console.log('Overall Statistics (Latest Prices Only):');
    console.log(`  Cards with buy price: ${totalWithBuyPrice}`);
    console.log(`  Cards with sell URL: ${totalWithUrl}`);
    console.log(`  URL coverage: ${urlCoverage}%\n`);

    const setStats = new Map<string, { total: number; withUrl: number }>();
    for (const price of latestPrices) {
        if (price.buyPriceYen === null) continue;

        const stats = setStats.get(price.setCode) || { total: 0, withUrl: 0 };
        stats.total++;
        if (price.sellSourceUrl !== null) stats.withUrl++;
        setStats.set(price.setCode, stats);
    }

    console.log('Statistics by Set:');
    const sortedSets = Array.from(setStats.entries()).sort((a, b) => b[1].total - a[1].total);
    for (const [setCode, stats] of sortedSets) {
        const pct = ((stats.withUrl / stats.total) * 100).toFixed(2);
        console.log(`  ${setCode}: ${stats.withUrl}/${stats.total} (${pct}%)`);
    }

    const missingHighValue = await prisma.$queryRaw<Array<{
        name: string;
        setCode: string;
        collectorNumber: string;
        language: string;
        isFoil: number;
        buyPriceYen: number;
    }>>`
        WITH LatestPrices AS (
            SELECT 
                p.*,
                ROW_NUMBER() OVER (PARTITION BY p.variantId ORDER BY p.timestamp DESC) as rn
            FROM Price p
            WHERE p.shopId = ${shop.id}
        )
        SELECT 
            c.name,
            cv.setCode,
            cv.collectorNumber,
            cv.language,
            cv.isFoil,
            lp.buyPriceYen
        FROM LatestPrices lp
        JOIN CardVariant cv ON lp.variantId = cv.id
        JOIN Card c ON cv.cardId = c.id
        WHERE lp.rn = 1
        AND lp.buyPriceYen >= 50
        AND lp.sellSourceUrl IS NULL
        ORDER BY lp.buyPriceYen DESC
        LIMIT 20
    `;

    console.log('\nHigh-value cards missing URLs (≥50 yen):');
    if (missingHighValue.length === 0) {
        console.log('  ✓ None found - all high-value cards have URLs!');
    } else {
        console.log('  Card Name | Set | CN | Lang | Foil | Price');
        console.log('  ' + '-'.repeat(70));
        for (const card of missingHighValue) {
            const foil = card.isFoil ? 'Yes' : 'No';
            console.log(`  ${card.name.padEnd(30)} | ${card.setCode} | ${card.collectorNumber.padEnd(4)} | ${card.language} | ${foil.padEnd(4)} | ¥${card.buyPriceYen}`);
        }
    }

    const threshold30Count = await prisma.$queryRaw<Array<{ count: number }>>`
        WITH LatestPrices AS (
            SELECT 
                p.*,
                ROW_NUMBER() OVER (PARTITION BY p.variantId ORDER BY p.timestamp DESC) as rn
            FROM Price p
            WHERE p.shopId = ${shop.id}
        )
        SELECT COUNT(*) as count
        FROM LatestPrices
        WHERE rn = 1
        AND buyPriceYen <= 30
        AND sellSourceUrl IS NULL
    `;

    console.log(`\n≤30 yen cards missing URLs: ${threshold30Count[0].count}`);
    console.log('  (Expected - Hareruya doesn\'t list cards <30 yen in search)\n');

    await prisma.$disconnect();
}

verifyKaitoriData().catch(console.error);


import { scrapeHareruyaSet } from './shops/hareruya_set';
import { scrapeHareruyaKaitori } from './shops/hareruya_kaitori';
import { scrapeCardRushSet } from './shops/cardrush_set';
import { scrapeCardRushKaitori } from './shops/cardrush_kaitori';
import { prisma } from '../lib/prisma';

export interface ScraperOptions {
    shop?: 'hareruya' | 'cardrush';
    priceType?: 'buy' | 'sell';
}

const SETS = ['ECL', 'ECC', 'SPG', 'TMT', 'TMC', 'PZA'];

export async function runScraper(options: ScraperOptions = {}) {
    const { shop, priceType } = options;
    const parts: string[] = [];
    if (shop) parts.push(shop);
    if (priceType) parts.push(priceType);
    const sourceName = parts.length > 0 ? parts.join(' ') : 'all sources';
    console.log(`Starting scraper for ${sourceName}...`);

    try {
        const runHareruya = !shop || shop === 'hareruya';
        const runCardrush = !shop || shop === 'cardrush';
        const runBuy = !priceType || priceType === 'buy';
        const runSell = !priceType || priceType === 'sell';

        const tasks: Promise<void>[] = [];

        if (runHareruya) {
            const hrBuy = runBuy
                ? Promise.all(SETS.map(s => scrapeHareruyaSet(s, prisma).catch(e => console.error(`[Hareruya Set] ${s}:`, e))))
                : Promise.resolve([]);
            const hrSell = runSell
                ? Promise.all(SETS.map(s => scrapeHareruyaKaitori(s, prisma).catch(e => console.error(`[Hareruya Kaitori] ${s}:`, e))))
                : Promise.resolve([]);
            tasks.push(Promise.all([hrBuy, hrSell]).then(() => {}));
        }

        if (runCardrush) {
            const crBuy = runBuy
                ? Promise.all(SETS.map(s => scrapeCardRushSet(s, prisma).catch(e => console.error(`[CardRush Set] ${s}:`, e))))
                : Promise.resolve([]);
            const crSell = runSell
                ? Promise.all(SETS.map(s => scrapeCardRushKaitori(s, prisma).catch(e => console.error(`[CardRush Kaitori] ${s}:`, e))))
                : Promise.resolve([]);
            tasks.push(Promise.all([crBuy, crSell]).then(() => {}));
        }

        await Promise.all(tasks);

    } catch (e) {
        console.error('Error in scraper:', e);
    } finally {
        await prisma.$disconnect();
    }

    console.log('Scraper finished.');
}

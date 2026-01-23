
import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';
import { scrapeHareruyaSet } from './shops/hareruya_set';
import { scrapeHareruyaKaitori } from './shops/hareruya_kaitori';
import { scrapeCardRushSet } from './shops/cardrush_set';
import { scrapeCardRushKaitori } from './shops/cardrush_kaitori';

const prisma = new PrismaClient();

export interface ScraperOptions {
    shop?: 'hareruya' | 'cardrush';
    priceType?: 'buy' | 'sell';
}

export async function runScraper(options: ScraperOptions = {}) {
    const { shop, priceType } = options;
    const parts: string[] = [];
    if (shop) parts.push(shop);
    if (priceType) parts.push(priceType);
    const sourceName = parts.length > 0 ? parts.join(' ') : 'all sources';
    console.log(`Starting scraper for ${sourceName}...`);

    const browser = await chromium.launch({ headless: true });

    try {
        const runHareruya = !shop || shop === 'hareruya';
        const runCardrush = !shop || shop === 'cardrush';
        const runBuy = !priceType || priceType === 'buy';    // *_set scrapers
        const runSell = !priceType || priceType === 'sell';  // *_kaitori scrapers

        const tasks: Promise<void>[] = [];

        if (runHareruya) {
            tasks.push((async () => {
                // Hareruya - buy prices (set)
                if (runBuy) {
                    try {
                        await scrapeHareruyaSet('ECL', prisma, browser);
                        await scrapeHareruyaSet('ECC', prisma, browser);
                        await scrapeHareruyaSet('SPG', prisma, browser);
                    } catch (e) {
                        console.error('[Hareruya Set] Failed:', e);
                    }
                }
                // Hareruya - sell prices (kaitori)
                if (runSell) {
                    try {
                        await scrapeHareruyaKaitori('ECL', prisma, browser);
                        await scrapeHareruyaKaitori('ECC', prisma, browser);
                        await scrapeHareruyaKaitori('SPG', prisma, browser);
                    } catch (e) {
                        console.error('[Hareruya Kaitori] Failed:', e);
                    }
                }
            })());
        }

        if (runCardrush) {
            tasks.push((async () => {
                // CardRush - buy prices (set)
                if (runBuy) {
                    try {
                        await scrapeCardRushSet('ECL', prisma, browser);
                        await scrapeCardRushSet('ECC', prisma, browser);
                        await scrapeCardRushSet('SPG', prisma, browser);
                    } catch (e) {
                        console.error('[CardRush Set] Failed:', e);
                    }
                }
                // CardRush - sell prices (kaitori)
                if (runSell) {
                    try {
                        await scrapeCardRushKaitori('ECL', prisma, browser);
                        await scrapeCardRushKaitori('ECC', prisma, browser);
                        await scrapeCardRushKaitori('SPG', prisma, browser);
                    } catch (e) {
                        console.error('[CardRush Kaitori] Failed:', e);
                    }
                }
            })());
        }

        await Promise.all(tasks);

    } catch (e) {
        console.error('Error in scraper:', e);
    } finally {
        await browser.close();
        await prisma.$disconnect();
    }

    console.log('Scraper finished.');
}

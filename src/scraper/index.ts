
import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';
import { scrapeHareruyaSet } from './shops/hareruya_set';
import { scrapeCardRushSet } from './shops/cardrush_set';

const prisma = new PrismaClient();

export async function runScraper() {
    console.log('Starting set scraper...');

    const browser = await chromium.launch({ headless: true });

    try {
        // Crawl Lorwyn Eclipsed (ECL, ECC, SPG)
        try {
            await scrapeHareruyaSet('ECL', prisma, browser);
            await scrapeHareruyaSet('ECC', prisma, browser);
            await scrapeHareruyaSet('SPG', prisma, browser);
        } catch (e) {
            console.error('[Hareruya] Failed:', e);
        }

        // try {
        //     await scrapeCardRushSet('ECL', prisma, browser);
        // } catch (e) {
        //     console.error('[CardRush] Failed:', e);
        // }

    } catch (e) {
        console.error('Error in scraper:', e);
    } finally {
        await browser.close();
        await prisma.$disconnect();
    }

    console.log('Scraper finished.');
}

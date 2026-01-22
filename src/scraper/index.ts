
import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';
import { scrapeHareruyaSet } from './shops/hareruya_set';
import { scrapeHareruyaKaitori } from './shops/hareruya_kaitori';
import { scrapeCardRushSet } from './shops/cardrush_set';
import { scrapeCardRushKaitori } from './shops/cardrush_kaitori';

const prisma = new PrismaClient();

type DataSource = 'hareruya' | 'cardrush';

export async function runScraper(source?: DataSource) {
    const sourceName = source ? source : 'all sources';
    console.log(`Starting scraper for ${sourceName}...`);

    const browser = await chromium.launch({ headless: true });

    try {
        const scrapeHareruya = async () => {
            // Hareruya - Sell and Buy prices
            try {
                await scrapeHareruyaSet('ECL', prisma, browser);
                await scrapeHareruyaSet('ECC', prisma, browser);
                await scrapeHareruyaSet('SPG', prisma, browser);

                await scrapeHareruyaKaitori('ECL', prisma, browser);
                await scrapeHareruyaKaitori('ECC', prisma, browser);
                await scrapeHareruyaKaitori('SPG', prisma, browser);
            } catch (e) {
                console.error('[Hareruya] Failed:', e);
            }
        };

        const scrapeCardRush = async () => {
            // CardRush - Sell prices
            try {
                await scrapeCardRushSet('ECL', prisma, browser);
                await scrapeCardRushSet('ECC', prisma, browser);
                await scrapeCardRushSet('SPG', prisma, browser);
            } catch (e) {
                console.error('[CardRush Set] Failed:', e);
            }

            // CardRush - Buy prices (kaitori)
            try {
                await scrapeCardRushKaitori('ECL', prisma, browser);
                await scrapeCardRushKaitori('ECC', prisma, browser);
                await scrapeCardRushKaitori('SPG', prisma, browser);
            } catch (e) {
                console.error('[CardRush Kaitori] Failed:', e);
            }
        };

        // Run scrapers based on source parameter
        if (source === 'hareruya') {
            await scrapeHareruya();
        } else if (source === 'cardrush') {
            await scrapeCardRush();
        } else {
            // Run both simultaneously when no source specified
            await Promise.all([
                scrapeHareruya(),
                scrapeCardRush()
            ]);
        }

    } catch (e) {
        console.error('Error in scraper:', e);
    } finally {
        await browser.close();
        await prisma.$disconnect();
    }

    console.log('Scraper finished.');
}

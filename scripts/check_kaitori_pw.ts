
import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // Kaitori Top Page or Search
    // https://www.hareruyamtg.com/ja/purchase/product/search?product=...
    // Try "ローウィンの昏明" (Lorwyn Eclipsed)
    const query = "ローウィンの昏明";
    const url = `https://www.hareruyamtg.com/ja/purchase/product/search?product=${encodeURIComponent(query)}`;

    console.log(`Navigating to ${url}...`);

    try {
        await page.goto(url);
        console.log('Title:', await page.title());

        await page.screenshot({ path: 'debug_kaitori.png' });
        const html = await page.content();
        fs.writeFileSync('debug_kaitori.html', html);

        // Wait for results
        await page.waitForSelector('.itemList .item', { timeout: 10000 });
        console.log('Found Kaitori items!');

        const items = await page.$$('.itemList .item');
        if (items.length > 0) {
            const first = items[0];
            const text = await first.textContent();
            console.log('Sample Item Text:', text);

            // Check for price
            const priceEl = await first.$('.itemPrice');
            if (priceEl) {
                console.log('Price Text:', await priceEl.textContent());
            }
        }

    } catch (e) {
        console.error('Error:', e);
        await page.screenshot({ path: 'debug_kaitori_fail.png' });
    } finally {
        await browser.close();
    }
}

main();

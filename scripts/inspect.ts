
import { chromium } from 'playwright';

async function main() {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Hareruya
    console.log('Navigating to Hareruya...');

    page.on('request', request => console.log('>>', request.method(), request.url()));
    page.on('response', response => console.log('<<', response.status(), response.url()));

    await page.goto('https://www.hareruyamtg.com/ja/products/search?product=Sheoldred');

    // Wait for network idle or simple timeout because we are just logging
    await page.waitForTimeout(5000);

    // Wait for results
    await page.waitForSelector('.itemList');

    const products = await page.$$('.itemList .item');
    console.log(`Found ${products.length} products.`);

    if (products.length > 0) {
        const first = products[0];
        const link = await first.$eval('a', el => el.href);
        console.log('First product link:', link);

        // Go to product page
        await page.goto(link);
        const title = await page.title();
        console.log('Product Page Title:', title);

        // Try to find price
        // Usually .price class
        // Check for buy price and sell price
        // Hareruya usually lists variants (foil, condition) in a table
    }

    // Dump some HTML of the product page to analyze structure if needed
    // const content = await page.content();
    // console.log(content.slice(0, 1000));

    const content = await page.content();
    const fs = require('fs');
    fs.writeFileSync('inspect_hareruya.html', content);
    console.log('Dumped HTML to inspect_hareruya.html');

    await browser.close();
}

main().catch(console.error);

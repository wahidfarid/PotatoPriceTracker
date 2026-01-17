
import { chromium } from 'playwright';

async function main() {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    console.log('Navigating to CardRush...');

    page.on('request', request => console.log('>>', request.method(), request.url()));
    page.on('response', response => console.log('<<', response.status(), response.url()));

    await page.goto('https://www.cardrush-mtg.jp/product-list?keyword=Sheoldred');

    // Wait a bit
    await page.waitForTimeout(5000);

    const content = await page.content();
    const fs = require('fs');
    fs.writeFileSync('inspect_cardrush.html', content);
    console.log('Dumped HTML to inspect_cardrush.html');

    await browser.close();
}

main().catch(console.error);

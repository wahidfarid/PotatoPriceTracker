import { chromium } from "playwright";
import fs from "fs";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const query = "ローウィン";
  const url = `https://www.hareruyamtg.com/ja/products/search?product=${encodeURIComponent(query)}`;

  console.log(`Navigating to ${url}`);
  await page.goto(url);

  console.log("Waiting for content...");
  try {
    await page.waitForSelector(".itemList .item", { timeout: 5000 });
    console.log("Found items!");
  } catch (e) {
    console.log("Items not found. Dumping HTML...");
    const html = await page.content();
    fs.writeFileSync("debug_hareruya_set.html", html);
    await page.screenshot({ path: "debug_hareruya_set.png" });
  }

  await browser.close();
}

main();

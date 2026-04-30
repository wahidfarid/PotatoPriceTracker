import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Search for the set name in English or Japanese
  // Lorwyn Eclipsed -> ローウィン・エクリプス ?
  // Let's search for "Lorwyn" and see if "Lorwyn Eclipsed" appears in categories.

  const query = "Lorwyn Eclipsed";
  console.log(`Searching for set: ${query}`);

  await page.goto(
    `https://www.hareruyamtg.com/ja/products/search?product=${encodeURIComponent(query)}`,
  );

  // They often list sets in the sidebar or filter.
  // URL for set usually looks like: https://www.hareruyamtg.com/ja/products/search?cardset=226

  // Let's dump the "cardset" options if present
  // or check if there are results and what set they belong to.

  // Try to find a dropdown for 'cardset'
  // Or navigate to "Expansion" page: https://www.hareruyamtg.com/ja/products/search?suggest_type=expansion

  await page.goto("https://www.hareruyamtg.com/ja/search/advanced");

  // Wait for selector
  try {
    await page.waitForSelector('select[name="cardset"]');
    const options = await page.$$eval('select[name="cardset"] option', (els) =>
      els.map((el) => ({
        id: el.value,
        text: el.textContent,
      })),
    );

    const match = options.find(
      (o) => o.text?.includes("Lorwyn") || o.text?.includes("ローウィン"),
    );

    console.log(
      "Matches:",
      options.filter(
        (o) =>
          o.text?.toLowerCase().includes("lorwyn") ||
          o.text?.includes("クリプス"),
      ),
    );
  } catch (e) {
    console.log("Could not find cardset select", e);
  }

  await browser.close();
}

main();

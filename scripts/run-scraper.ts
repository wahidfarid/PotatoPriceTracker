import { runScraper, ScraperOptions } from "../src/scraper";

const SHOPS = ["hareruya", "cardrush"] as const;
const PRICE_TYPES = ["buy", "sell"] as const;

type Shop = (typeof SHOPS)[number];
type PriceType = (typeof PRICE_TYPES)[number];

function isShop(arg: string): arg is Shop {
  return SHOPS.includes(arg as Shop);
}

function isPriceType(arg: string): arg is PriceType {
  return PRICE_TYPES.includes(arg as PriceType);
}

function showUsage(): never {
  console.error("Usage: tsx scripts/run-scraper.ts [shop] [type]");
  console.error("");
  console.error("Options:");
  console.error("  shop: hareruya | cardrush");
  console.error("  type: buy (set prices) | sell (kaitori prices)");
  console.error("");
  console.error("Examples:");
  console.error("  tsx scripts/run-scraper.ts              # run all scrapers");
  console.error(
    "  tsx scripts/run-scraper.ts hareruya     # run hareruya only",
  );
  console.error(
    "  tsx scripts/run-scraper.ts buy          # run all *_set scrapers",
  );
  console.error(
    "  tsx scripts/run-scraper.ts cardrush sell # run cardrush kaitori only",
  );
  process.exit(1);
}

// Parse arguments (order doesn't matter)
const args = process.argv.slice(2);
const options: ScraperOptions = {};

for (const arg of args) {
  if (isShop(arg)) {
    if (options.shop) {
      console.error(`Error: Multiple shops specified: ${options.shop}, ${arg}`);
      showUsage();
    }
    options.shop = arg;
  } else if (isPriceType(arg)) {
    if (options.priceType) {
      console.error(
        `Error: Multiple price types specified: ${options.priceType}, ${arg}`,
      );
      showUsage();
    }
    options.priceType = arg;
  } else {
    console.error(`Error: Invalid argument: ${arg}`);
    showUsage();
  }
}

runScraper(options).catch(console.error);

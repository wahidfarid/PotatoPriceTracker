import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import { scrapeHareruyaSet } from "../src/scraper/shops/hareruya_set";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting ECC-only scraper...");
  const browser = await chromium.launch({ headless: true });

  try {
    await scrapeHareruyaSet("ECC", prisma, browser);
  } catch (e) {
    console.error("ECC Scraper failed:", e);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

main();

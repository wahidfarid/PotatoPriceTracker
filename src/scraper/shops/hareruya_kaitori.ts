import { PrismaClient } from "@prisma/client";
import { load } from "cheerio";
import { detectFinish } from "../utils/detectFinish";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function scrapeHareruyaKaitori(
  setCode: string,
  prisma: PrismaClient,
) {
  console.log(`[Hareruya Kaitori] Starting HTML crawl for set: ${setCode}`);

  const shop = await prisma.shop.findUniqueOrThrow({
    where: { name: "Hareruya" },
  });

  const allVariants = await prisma.cardVariant.findMany({
    where: { setCode: setCode.toUpperCase() },
  });

  const variantByCN = new Map<string, (typeof allVariants)[0]>();
  for (const v of allVariants) {
    variantByCN.set(`${v.collectorNumber}-${v.language}-${v.finish}`, v);
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentPrices = await prisma.price.findMany({
    where: {
      variant: { setCode: setCode.toUpperCase() },
      shopId: shop.id,
      timestamp: { gte: cutoff },
    },
    orderBy: { timestamp: "desc" },
  });

  const recentPriceMap = new Map<string, (typeof recentPrices)[0]>();
  for (const p of recentPrices) {
    if (!recentPriceMap.has(p.variantId)) recentPriceMap.set(p.variantId, p);
  }

  const toUpdate: { id: string; buyPriceYen: number; sellSourceUrl: string }[] =
    [];
  const toCreate: any[] = [];

  let currentPage = 1;
  let hasNext = true;

  while (hasNext) {
    const url = `https://www.hareruyamtg.com/ja/purchase/search?product=${encodeURIComponent(setCode)}&page=${currentPage}`;
    console.log(`[Hareruya Kaitori] Fetching ${url}`);

    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const $ = load(html);

      const cards: { title: string; priceText: string; href: string }[] = [];
      $(".itemList").each((_, el) => {
        const title = $(el).find(".itemName").text().trim();
        const priceText = $(el).find(".itemDetail__price").text().trim();
        const href =
          $(el).find(".itemName").attr("href") ||
          $(el).find("a").attr("href") ||
          "";
        cards.push({ title, priceText, href });
      });

      if (cards.length === 0) {
        hasNext = false;
        break;
      }

      for (const { title, priceText, href } of cards) {
        const priceYen = parseInt(priceText.replace(/[^0-9]/g, ""), 10);
        if (isNaN(priceYen)) continue;

        if (
          title.includes("Box") ||
          title.includes("Pack") ||
          title.includes("Supply")
        )
          continue;
        if (
          !title.includes(`[${setCode.toUpperCase()}]`) &&
          !title.includes(`[${setCode.toUpperCase()}-`)
        )
          continue;

        const cnMatch = title.match(/\((\d+)\)/);
        let collectorNumber = cnMatch ? cnMatch[1] : null;
        if (collectorNumber)
          collectorNumber = parseInt(collectorNumber, 10).toString();

        let lang = "JP";
        if (
          title.includes("【EN】") ||
          title.includes("[EN]") ||
          title.includes("英語版")
        )
          lang = "EN";
        const { finish } = detectFinish(title);

        const v = collectorNumber
          ? variantByCN.get(`${collectorNumber}-${lang}-${finish}`)
          : undefined;
        if (!v) continue;

        const recentPrice = recentPriceMap.get(v.id);
        if (recentPrice) {
          toUpdate.push({
            id: recentPrice.id,
            buyPriceYen: priceYen,
            sellSourceUrl: href,
          });
        } else {
          toCreate.push({
            variantId: v.id,
            shopId: shop.id,
            priceYen: 0,
            stock: 0,
            buyPriceYen: priceYen,
            sellSourceUrl: href,
          });
        }
      }

      if (cards.length < 20) hasNext = false;
      else currentPage++;
    } catch (e) {
      console.error(`[Hareruya Kaitori] Error on page ${currentPage}:`, e);
      hasNext = false;
    }
  }

  if (toUpdate.length > 0) {
    await prisma.$transaction(
      toUpdate.map((u) =>
        prisma.price.update({
          where: { id: u.id },
          data: { buyPriceYen: u.buyPriceYen, sellSourceUrl: u.sellSourceUrl },
        }),
      ),
    );
  }
  if (toCreate.length > 0) {
    await prisma.price.createMany({ data: toCreate });
  }
  console.log(
    `[Hareruya Kaitori] Updated ${toUpdate.length}, created ${toCreate.length} for ${setCode}`,
  );
}

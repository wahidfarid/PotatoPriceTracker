import { PrismaClient } from "@prisma/client";
import { load } from "cheerio";
import { detectFinish } from "../utils/detectFinish";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function scrapeCardRushSet(setCode: string, prisma: PrismaClient) {
  console.log(`[CardRush] Starting crawl for set: ${setCode}`);

  const shop = await prisma.shop.findUniqueOrThrow({
    where: { name: "CardRush" },
  });

  const allVariants = await prisma.cardVariant.findMany({
    where: { setCode: setCode.toUpperCase() },
    include: { card: true },
  });

  const variantByCN = new Map<string, (typeof allVariants)[0]>();
  const variantsByName = new Map<string, typeof allVariants>();
  for (const v of allVariants) {
    variantByCN.set(`${v.collectorNumber}-${v.language}-${v.finish}`, v);
    const nameKey = `${v.card.name}-${v.language}-${v.finish}`;
    if (!variantsByName.has(nameKey)) variantsByName.set(nameKey, []);
    variantsByName.get(nameKey)!.push(v);
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentKaitori = await prisma.price.findMany({
    where: {
      variant: { setCode: setCode.toUpperCase() },
      shopId: shop.id,
      buyPriceYen: { not: null },
      timestamp: { gte: cutoff },
    },
    orderBy: { timestamp: "desc" },
  });

  const kaitorMap = new Map<string, (typeof recentKaitori)[0]>();
  for (const p of recentKaitori) {
    if (!kaitorMap.has(p.variantId)) kaitorMap.set(p.variantId, p);
  }

  const pricesToCreate: any[] = [];
  const query = setCode.toUpperCase();
  let currentUrl: string | null =
    `https://www.cardrush-mtg.jp/product-list?keyword=${encodeURIComponent(query)}`;

  try {
    while (currentUrl) {
      console.log(`[CardRush] Scraping ${currentUrl}`);

      const res = await fetch(currentUrl, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const $ = load(html);

      $("a.item_data_link").each((_, el) => {
        try {
          const title = $(el).find(".item_name .goods_name").text().trim();
          const relativeHref = $(el).attr("href") || "";
          const priceText = $(el).find(".selling_price .figure").text().trim();
          if (!title || !priceText || !relativeHref) return;

          const href = relativeHref.startsWith("http")
            ? relativeHref
            : `https://www.cardrush-mtg.jp${relativeHref}`;

          const { isFoil, finish } = detectFinish(title);

          const isShowcase = title.includes("(ショーケース枠)");
          const isFullArt =
            title.includes("(Full Art)") || title.includes("(フルアート)");

          const isEN = title.includes("《英語》");
          const lang = isEN ? "EN" : "JP";

          const cnMatch = title.match(/\(0*(\d+)\)/);
          let collectorNumber: string | null = null;
          if (cnMatch) collectorNumber = parseInt(cnMatch[1], 10).toString();

          const beforeLang = title.split("《")[0].trim();
          const slashIndex = beforeLang.indexOf("/");
          let cardName =
            slashIndex > -1
              ? beforeLang.substring(slashIndex + 1).trim()
              : beforeLang;
          cardName = cardName
            .replace(/\[EX\+\]/g, "")
            .replace(/\(FOIL\)/g, "")
            .replace(/\(ショーケース枠\)/g, "")
            .replace(/\(ダブルレインボウFOIL\)/g, "")
            .replace(/\(Full Art\)/g, "")
            .replace(/\(フルアート\)/g, "")
            .replace(/\(Fracture FOIL\)/g, "")
            .replace(/\(フラクチャーFOIL\)/g, "")
            .replace(/\(サージFOIL\)/g, "")
            .replace(/\(0*\d+\)/g, "")
            .trim();

          const priceYen = parseInt(priceText.replace(/[^\d]/g, ""));
          if (isNaN(priceYen) || priceYen <= 0) return;

          const stockText = $(el).find(".stock").text().trim();
          const stockNumMatch = stockText.match(/(\d+)/);
          const stockCount = stockNumMatch ? parseInt(stockNumMatch[1], 10) : 0;

          let v: (typeof allVariants)[0] | undefined;

          if (collectorNumber) {
            v = variantByCN.get(`${collectorNumber}-${lang}-${finish}`);
          }

          if (!v && !collectorNumber && cardName) {
            let candidates =
              variantsByName.get(`${cardName}-${lang}-${finish}`) || [];
            if (
              candidates.length === 0 &&
              finish !== "foil" &&
              finish !== "nonfoil"
            ) {
              candidates = variantsByName.get(`${cardName}-${lang}-foil`) || [];
            }
            if (finish === "fracturefoil") {
              v = candidates.find((c) =>
                c.promoTypes?.includes("fracturefoil"),
              );
            } else if (isShowcase) {
              v = candidates.find((c) => c.frameEffects?.includes("showcase"));
            } else if (finish === "doublerainbowfoil") {
              v = candidates.find((c) =>
                c.promoTypes?.includes("doublerainbow"),
              );
            } else if (isFullArt) {
              v = candidates.find(
                (c) =>
                  c.frameEffects?.includes("inverted") ||
                  c.frameEffects?.includes("extendedart"),
              );
            } else {
              const filtered = candidates.filter(
                (c) =>
                  !c.frameEffects?.includes("showcase") &&
                  !c.frameEffects?.includes("extendedart") &&
                  !c.frameEffects?.includes("inverted") &&
                  (c.promoTypes == null ||
                    !c.promoTypes.includes("doublerainbow")),
              );
              if (filtered.length === 1) v = filtered[0];
              else if (filtered.length > 1) {
                const candidateCNs = filtered
                  .map((x) => x.collectorNumber)
                  .join(", ");
                console.log(
                  `[CardRush] AMBIGUOUS: "${cardName}" | ${lang}/${finish} | found ${filtered.length}: [${candidateCNs}]`,
                );
              }
            }
            if (!v && candidates.length === 0) {
              console.log(
                `[CardRush] NO MATCH: "${cardName}" | CN:none | ${lang}/${finish}`,
              );
            }
          }

          if (
            !v &&
            collectorNumber &&
            finish !== "foil" &&
            finish !== "nonfoil"
          ) {
            const foilVariant =
              variantByCN.get(`${collectorNumber}-${lang}-foil`) ||
              variantByCN.get(`${collectorNumber}-${lang}-nonfoil`);
            if (foilVariant) {
              console.log(
                `[CardRush] Creating on-the-fly ${finish} variant for CN:${collectorNumber} ${lang}`,
              );
              prisma.cardVariant
                .create({
                  data: {
                    cardId: foilVariant.cardId,
                    setCode: foilVariant.setCode,
                    collectorNumber: foilVariant.collectorNumber,
                    language: foilVariant.language,
                    isFoil: true,
                    finish,
                    scryfallId: foilVariant.scryfallId,
                    image: foilVariant.image,
                    frameEffects: foilVariant.frameEffects,
                    promoTypes: foilVariant.promoTypes,
                  },
                })
                .then((created) => {
                  const createdWithCard = {
                    ...created,
                    card: foilVariant.card,
                  };
                  variantByCN.set(
                    `${created.collectorNumber}-${created.language}-${finish}`,
                    createdWithCard as (typeof allVariants)[0],
                  );
                })
                .catch((e) =>
                  console.error(
                    `[CardRush] Error creating on-the-fly variant:`,
                    e,
                  ),
                );
            }
          }

          if (v) {
            const latestKaitori = kaitorMap.get(v.id);
            pricesToCreate.push({
              variantId: v.id,
              shopId: shop.id,
              priceYen,
              stock: stockCount,
              sourceUrl: href,
              buyPriceYen: latestKaitori?.buyPriceYen ?? null,
              sellSourceUrl: latestKaitori?.sellSourceUrl ?? null,
            });
            console.log(
              `[CardRush] Matched ${cardName} -> CN:${v.collectorNumber} (${lang}/${finish})`,
            );
          }
        } catch (e) {
          // ignore per-item errors
        }
      });

      const nextHref = $("a.to_next_page").attr("href");
      if (nextHref) {
        currentUrl = nextHref.startsWith("http")
          ? nextHref
          : `https://www.cardrush-mtg.jp${nextHref}`;
      } else {
        currentUrl = null;
      }
    }
  } catch (e) {
    console.error(`[CardRush] Error:`, e);
  }

  if (pricesToCreate.length > 0) {
    await prisma.price.createMany({ data: pricesToCreate });
    console.log(
      `[CardRush] Created ${pricesToCreate.length} price records for ${setCode}`,
    );
  }
}

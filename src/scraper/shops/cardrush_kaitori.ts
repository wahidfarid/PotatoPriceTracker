import { PrismaClient } from "@prisma/client";
import { detectFinish } from "../utils/detectFinish";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function scrapeCardRushKaitori(
  setCode: string,
  prisma: PrismaClient,
) {
  console.log(`[CardRush Kaitori] Starting crawl for set: ${setCode}`);

  const shop = await prisma.shop.findUniqueOrThrow({
    where: { name: "CardRush" },
  });

  const allVariants = await prisma.cardVariant.findMany({
    where: { setCode: setCode.toUpperCase() },
    include: { card: true },
  });

  const variantByCN = new Map<string, (typeof allVariants)[0]>();
  for (const v of allVariants) {
    variantByCN.set(`${v.collectorNumber}-${v.language}-${v.finish}`, v);
  }

  const variantsByName = new Map<string, typeof allVariants>();
  for (const v of allVariants) {
    const nameKey = `${v.card.name}-${v.language}-${v.finish}`;
    if (!variantsByName.has(nameKey)) variantsByName.set(nameKey, []);
    variantsByName.get(nameKey)!.push(v);
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

  const buildUrl = (page: number, cardName = "") => {
    const base = "https://cardrush.media/mtg/buying_prices";
    const params = new URLSearchParams();
    params.set("displayMode", "リスト");
    params.set("limit", "1000");
    params.set("name", cardName);
    params.set("rarity", "");
    params.set("model_number", "");
    params.set("amount", "");
    params.set("page", String(page));
    params.append("sort[key]", "name");
    params.append("sort[order]", "desc");
    params.append("associations[]", "ocha_product");
    params.append("to_json_option[methods]", "name_with_condition");
    params.append("to_json_option[except][]", "original_image_source");
    params.append("to_json_option[except][]", "created_at");
    params.append("to_json_option[include][ocha_product][only][]", "id");
    params.append(
      "to_json_option[include][ocha_product][methods][]",
      "image_source",
    );
    params.append("display_category[]", "高額系");
    params.append("display_category[]", "foil系");
    params.append("display_category[]", "スタンダード");
    params.append("display_category[]", "スタンダード最新弾");
    params.append("display_category[]", "パイオニア以下");
    params.append("display_category[]", "モダン以下最新弾");
    params.set("pack_code", setCode.toUpperCase());
    params.append("is_hot[]", "true");
    params.append("is_hot[]", "false");
    return `${base}?${params.toString()}`;
  };

  try {
    let currentPage = 1;
    let lastPage = 1;

    do {
      const url = buildUrl(currentPage);
      console.log(`[CardRush Kaitori] Scraping page ${currentPage}`);

      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();

      const match = html.match(
        /<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/,
      );
      if (!match) {
        console.error(
          `[CardRush Kaitori] Could not find __NEXT_DATA__ on page ${currentPage}`,
        );
        break;
      }

      const nextData = JSON.parse(match[1]);
      const buyingPrices = nextData?.props?.pageProps?.buyingPrices || [];
      if (currentPage === 1) {
        lastPage = nextData?.props?.pageProps?.lastPage ?? 1;
      }

      console.log(
        `[CardRush Kaitori] Found ${buyingPrices.length} cards on page ${currentPage} (lastPage: ${lastPage})`,
      );

      for (const card of buyingPrices) {
        if (!card) continue;

        const priceYen = card.amount;
        if (!priceYen || priceYen === 0) continue;

        const fullName = card.name || "";
        if (
          fullName.includes("Box") ||
          fullName.includes("Pack") ||
          fullName.includes("Supply")
        )
          continue;

        const nameParts = fullName.split("/");
        let cardName =
          nameParts.length > 1 ? nameParts[1].trim() : fullName.trim();

        const { finish } = detectFinish(fullName);

        const isShowcase =
          fullName.includes("(ショーケース枠)") ||
          fullName.includes("(ショーケース)");
        const isFullArt =
          fullName.includes("(フルアート)") ||
          fullName.includes("(拡張アート)");

        let lang = "JP";
        if (card.language === "英語") lang = "EN";

        cardName = cardName
          .replace(/\(FOIL\)/gi, "")
          .replace(/\[Foil\]/gi, "")
          .replace(/\(ショーケース枠\)/g, "")
          .replace(/\(ショーケース\)/g, "")
          .replace(/\(ダブルレインボウFOIL\)/g, "")
          .replace(/\(フルアート\)/g, "")
          .replace(/\(拡張アート\)/g, "")
          .replace(/\(フラクチャーFOIL\)/g, "")
          .replace(/\(サージFOIL\)/g, "")
          .replace(/\(0*\d+\)/g, "")
          .trim();

        let collectorNumber: string | null = null;
        if (card.model_number) {
          const cnMatch = card.model_number.match(/(\d+)/);
          if (cnMatch) collectorNumber = parseInt(cnMatch[1], 10).toString();
        }

        let variant: (typeof allVariants)[0] | undefined;

        if (collectorNumber) {
          variant = variantByCN.get(`${collectorNumber}-${lang}-${finish}`);
        }

        if (!variant && cardName) {
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
            variant = candidates.find((c) =>
              c.promoTypes?.includes("fracturefoil"),
            );
          } else if (isShowcase) {
            variant = candidates.find((c) =>
              c.frameEffects?.includes("showcase"),
            );
          } else if (finish === "doublerainbowfoil") {
            variant = candidates.find((c) =>
              c.promoTypes?.includes("doublerainbow"),
            );
          } else if (isFullArt) {
            variant = candidates.find(
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
            if (filtered.length === 1) variant = filtered[0];
            else if (filtered.length > 1) {
              console.log(
                `[CardRush Kaitori] AMBIGUOUS: "${cardName}" | ${lang}/${finish}`,
              );
            }
          }
          if (!variant && candidates.length === 0) {
            console.log(
              `[CardRush Kaitori] NO MATCH: "${cardName}" | ${lang}/${finish}`,
            );
          }
        }

        if (variant) {
          const cardUrl = buildUrl(1, variant.card.name);
          const recentPrice = recentPriceMap.get(variant.id);
          if (recentPrice) {
            toUpdate.push({
              id: recentPrice.id,
              buyPriceYen: priceYen,
              sellSourceUrl: cardUrl,
            });
          } else {
            const lastSetPrice = recentPrices.find(
              (p) => p.variantId === variant!.id && p.priceYen > 0,
            );
            toCreate.push({
              variantId: variant.id,
              shopId: shop.id,
              priceYen: lastSetPrice?.priceYen ?? 0,
              stock: lastSetPrice?.stock ?? 0,
              buyPriceYen: priceYen,
              sellSourceUrl: cardUrl,
            });
          }
        }
      }

      currentPage++;
    } while (currentPage <= lastPage);
  } catch (e) {
    console.error(`[CardRush Kaitori] Error:`, e);
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
    `[CardRush Kaitori] Updated ${toUpdate.length}, created ${toCreate.length} for ${setCode}`,
  );
}

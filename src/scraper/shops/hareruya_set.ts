import { PrismaClient } from "@prisma/client";
import { detectFinish } from "../utils/detectFinish";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function scrapeHareruyaSet(setCode: string, prisma: PrismaClient) {
  console.log(`[Hareruya] Starting API crawl for set: ${setCode}`);

  const shop = await prisma.shop.findUniqueOrThrow({
    where: { name: "Hareruya" },
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
  const query = `[${setCode}]`;
  let page = 1;
  const rows = 30;
  let hasNext = true;

  while (hasNext) {
    const url = `https://www.hareruyamtg.com/ja/products/search/unisearch_api?kw=${encodeURIComponent(query)}&rows=${rows}&page=${page}`;

    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();

      const docs = json.response?.docs || [];
      if (docs.length === 0) {
        hasNext = false;
        break;
      }

      console.log(`[Hareruya] Page ${page}: ${docs.length} items`);

      for (const doc of docs) {
        const title = doc.product_name;

        const isSealed =
          title.includes("Box") ||
          title.includes("Pack") ||
          title.includes("Supply") ||
          title.includes("スリーブ") ||
          title.includes("デッキ") ||
          title.includes("30パック");
        if (isSealed) continue;

        const setTag = `[${setCode.toUpperCase()}]`;
        const setTagPrefix = `[${setCode.toUpperCase()}-`;
        if (!title.includes(setTag) && !title.includes(setTagPrefix)) continue;

        const priceYen = parseInt(doc.price);
        const productUrl = `https://www.hareruyamtg.com/ja/products/detail/${doc.product}`;

        let lang = "JP";
        if (doc.language == 2) lang = "EN";
        else if (doc.language == 1) lang = "JP";
        else if (
          title.includes("English") ||
          title.includes("英語版") ||
          title.includes("【EN】") ||
          title.includes("[EN]")
        )
          lang = "EN";

        const { isFoil, finish } = detectFinish(title, doc.foil_flg);

        let matchName: string | null = null;
        if (doc.product_name_en) {
          const m = doc.product_name_en.match(/《(.*?)》/);
          if (m) matchName = m[1];
        }
        if (!matchName) {
          const m = title.match(/《(.*?)》/);
          if (m) {
            let extracted = m[1];
            if (extracted.includes("/"))
              extracted = extracted.split("/")[1].trim();
            matchName = extracted;
          }
        }

        const cnMatch = title.match(/\((\d+)\)/);
        let collectorNumber = cnMatch ? cnMatch[1] : null;
        if (collectorNumber)
          collectorNumber = parseInt(collectorNumber, 10).toString();

        let v = collectorNumber
          ? variantByCN.get(`${collectorNumber}-${lang}-${finish}`)
          : undefined;
        if (!v && matchName) {
          const nameMatches =
            variantsByName.get(`${matchName}-${lang}-${finish}`) || [];
          if (nameMatches.length === 1) v = nameMatches[0];
        }

        if (!v && finish !== "foil" && finish !== "nonfoil") {
          const foilVariant = collectorNumber
            ? variantByCN.get(`${collectorNumber}-${lang}-foil`)
            : matchName
              ? (variantsByName.get(`${matchName}-${lang}-foil`) || [])[0]
              : undefined;

          const sourceVariant =
            foilVariant ||
            (collectorNumber
              ? variantByCN.get(`${collectorNumber}-${lang}-nonfoil`)
              : undefined);

          if (sourceVariant) {
            console.log(
              `[Hareruya] Creating on-the-fly ${finish} variant for CN:${collectorNumber ?? matchName} ${lang}`,
            );
            const created = await prisma.cardVariant.create({
              data: {
                cardId: sourceVariant.cardId,
                setCode: sourceVariant.setCode,
                collectorNumber: sourceVariant.collectorNumber,
                language: sourceVariant.language,
                isFoil: true,
                finish,
                scryfallId: sourceVariant.scryfallId,
                image: sourceVariant.image,
                frameEffects: sourceVariant.frameEffects,
                promoTypes: sourceVariant.promoTypes,
              },
            });
            const createdWithCard = { ...created, card: sourceVariant.card };
            variantByCN.set(
              `${created.collectorNumber}-${created.language}-${finish}`,
              createdWithCard as (typeof allVariants)[0],
            );
            const nameKey = `${sourceVariant.card.name}-${created.language}-${finish}`;
            if (!variantsByName.has(nameKey)) variantsByName.set(nameKey, []);
            variantsByName
              .get(nameKey)!
              .push(createdWithCard as (typeof allVariants)[0]);
            v = createdWithCard as (typeof allVariants)[0];
          }
        }

        if (v) {
          const latestKaitori = kaitorMap.get(v.id);
          const stock = parseInt(doc.stock || "0");
          pricesToCreate.push({
            variantId: v.id,
            shopId: shop.id,
            priceYen,
            stock,
            sourceUrl: productUrl,
            buyPriceYen: latestKaitori?.buyPriceYen ?? null,
            sellSourceUrl: latestKaitori?.sellSourceUrl ?? null,
          });
        }
      }

      if (json.response.numFound <= page * rows) hasNext = false;
      else page++;
    } catch (e) {
      console.error(`[Hareruya] API Error:`, e);
      hasNext = false;
    }
  }

  if (pricesToCreate.length > 0) {
    await prisma.price.createMany({ data: pricesToCreate });
    console.log(
      `[Hareruya] Created ${pricesToCreate.length} price records for ${setCode}`,
    );
  }
}

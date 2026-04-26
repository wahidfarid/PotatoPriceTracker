import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function fetchWithTimeout(url: string, ms = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// Fetch all JP printed_names for a set in one paginated call.
// Returns a map of collectorNumber → printed_name (null if no JP print).
async function fetchJpNamesForSet(
  setCode: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let query = `set:${setCode.toLowerCase()}+lang:ja+unique:prints`;
  if (setCode.toLowerCase() === "spg") {
    query += "+year:2026";
  }
  let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`;

  while (url) {
    let res: Response;
    try {
      res = await fetchWithTimeout(url);
    } catch (e) {
      console.warn(`JP set fetch timed out or failed for ${setCode}:`, e);
      break;
    }
    if (res.status === 404) break; // set has no JP prints
    if (!res.ok) {
      console.warn(`JP set fetch error ${res.status} for ${setCode}`);
      break;
    }
    const json = (await res.json()) as any;
    for (const card of json.data ?? []) {
      const name: string | null = card.printed_name ?? null;
      if (name) map.set(card.collector_number, name);
    }
    url = json.has_more ? json.next_page : "";
  }

  console.log(
    `  JP names fetched for ${setCode.toUpperCase()}: ${map.size} cards`,
  );
  return map;
}

async function seedSet(setCode: string) {
  console.log(`Fetching set: ${setCode.toUpperCase()} from Scryfall...`);

  // Fetch all JP names for the set upfront in one call
  const jpNames = await fetchJpNamesForSet(setCode);

  let query = `set:${setCode.toLowerCase()} unique:prints`;
  if (setCode.toLowerCase() === "spg") {
    query += " year:2026";
  }

  let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`;
  let hasMore = true;
  let count = 0;

  while (hasMore) {
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`Scryfall API error: ${res.status}`);

    const json = (await res.json()) as any;
    const data = json.data;

    if (!data) {
      console.log(`No data found for set ${setCode}.`);
      break;
    }

    for (const cardData of data) {
      const nameJa = jpNames.get(cardData.collector_number) ?? null;

      let dbCard = null;

      if (cardData.oracle_id) {
        dbCard = await prisma.card.findFirst({
          where: { oracleId: cardData.oracle_id },
        });
      }

      if (!dbCard) {
        dbCard = await prisma.card.findFirst({
          where: { name: cardData.name },
        });
      }

      if (!dbCard) {
        dbCard = await prisma.card.create({
          data: {
            name: cardData.name,
            oracleId: cardData.oracle_id,
            nameJa,
          },
        });
      } else if (!dbCard.nameJa && nameJa) {
        dbCard = await prisma.card.update({
          where: { id: dbCard.id },
          data: { nameJa },
        });
      }

      const finishes = cardData.finishes || [];
      const variantsToCreate: { isFoil: boolean; finish: string }[] = [];
      if (finishes.includes("nonfoil"))
        variantsToCreate.push({ isFoil: false, finish: "nonfoil" });
      if (finishes.includes("foil"))
        variantsToCreate.push({ isFoil: true, finish: "foil" });
      if (finishes.includes("etched"))
        variantsToCreate.push({ isFoil: true, finish: "etchedfoil" });

      const languages = ["EN", "JP"];

      for (const l of languages) {
        for (const v of variantsToCreate) {
          const exists = await prisma.cardVariant.findFirst({
            where: {
              cardId: dbCard.id,
              setCode: setCode.toUpperCase(),
              collectorNumber: cardData.collector_number,
              language: l,
              finish: v.finish,
            },
          });

          const frameEffects = cardData.frame_effects?.join(",") || null;
          const promoTypes = cardData.promo_types?.join(",") || null;
          const { finish } = v;

          if (!exists) {
            await prisma.cardVariant.create({
              data: {
                cardId: dbCard.id,
                setCode: setCode.toUpperCase(),
                collectorNumber: cardData.collector_number,
                language: l,
                isFoil: v.isFoil,
                scryfallId: cardData.id,
                image:
                  cardData.image_uris?.normal ||
                  cardData.card_faces?.[0]?.image_uris?.normal,
                frameEffects,
                promoTypes,
                finish,
              },
            });
            count++;
          } else {
            await prisma.cardVariant.update({
              where: { id: exists.id },
              data: {
                scryfallId: cardData.id,
                image:
                  cardData.image_uris?.normal ||
                  cardData.card_faces?.[0]?.image_uris?.normal,
                frameEffects,
                promoTypes,
                finish,
              },
            });
            count++;
          }
        }
      }
    }

    if (json.has_more) {
      url = json.next_page;
    } else {
      hasMore = false;
    }
  }
  console.log(
    `Seeded/updated ${count} variants for set ${setCode.toUpperCase()}.`,
  );
}

async function main() {
  const sets = ["ecl", "ecc", "spg", "tmt", "tmc", "pza", "sos", "soc", "soa"];
  for (const s of sets) {
    await seedSet(s);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

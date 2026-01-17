
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function seedSet(setCode: string) {
    console.log(`Fetching set: ${setCode.toUpperCase()} from Scryfall...`);

    let query = `set:${setCode.toLowerCase()} unique:prints`;
    if (setCode.toLowerCase() === 'spg') {
        query += ' year:2026'; // Only Lorwyn Eclipsed section of SPG
    }

    let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`;
    let hasMore = true;
    let count = 0;

    while (hasMore) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Scryfall API error: ${res.status}`);

        const json = (await res.json()) as any;
        const data = json.data;

        if (!data) {
            console.log(`No data found for set ${setCode}.`);
            break;
        }

        for (const cardData of data) {
            // Try to find existing card by oracle_id (if present) or name
            let dbCard = null;

            if (cardData.oracle_id) {
                dbCard = await prisma.card.findFirst({ where: { oracleId: cardData.oracle_id } });
            }

            if (!dbCard) {
                dbCard = await prisma.card.findFirst({ where: { name: cardData.name } });
            }

            if (!dbCard) {
                dbCard = await prisma.card.create({
                    data: {
                        name: cardData.name,
                        oracleId: cardData.oracle_id
                    }
                });
            }

            // Create Variant
            const finishes = cardData.finishes || [];
            const variantsToCreate = [];
            if (finishes.includes('nonfoil')) variantsToCreate.push({ isFoil: false });
            if (finishes.includes('foil')) variantsToCreate.push({ isFoil: true });

            const languages = ['EN', 'JP'];

            for (const l of languages) {
                for (const v of variantsToCreate) {
                    const exists = await prisma.cardVariant.findFirst({
                        where: {
                            cardId: dbCard.id,
                            setCode: setCode.toUpperCase(),
                            collectorNumber: cardData.collector_number,
                            language: l,
                            isFoil: v.isFoil
                        }
                    });

                    if (!exists) {
                        await prisma.cardVariant.create({
                            data: {
                                cardId: dbCard.id,
                                setCode: setCode.toUpperCase(),
                                collectorNumber: cardData.collector_number,
                                language: l,
                                isFoil: v.isFoil,
                                scryfallId: cardData.id,
                                image: cardData.image_uris?.normal || cardData.card_faces?.[0]?.image_uris?.normal
                            }
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
    console.log(`Seeded ${count} variants for set ${setCode.toUpperCase()}.`);
}

async function main() {
    const sets = ['ecl', 'ecc', 'spg'];
    for (const s of sets) {
        await seedSet(s);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function updateVariantFields() {
    const variants = await prisma.cardVariant.findMany({
        where: {
            frameEffects: null
        }
    });

    console.log(`Updating ${variants.length} variants with frame/promo information...`);

    let updated = 0;
    for (const variant of variants) {
        if (!variant.scryfallId) continue;

        try {
            const res = await fetch(`https://api.scryfall.com/cards/${variant.scryfallId}`);
            if (!res.ok) {
                console.error(`Failed to fetch ${variant.scryfallId}: ${res.status}`);
                continue;
            }

            const cardData = await res.json();

            const frameEffects = cardData.frame_effects?.join(',') || null;
            const promoTypes = cardData.promo_types?.join(',') || null;
            const finish = variant.isFoil ? 'foil' : 'nonfoil';

            await prisma.cardVariant.update({
                where: { id: variant.id },
                data: {
                    frameEffects,
                    promoTypes,
                    finish
                }
            });

            updated++;
            if (updated % 10 === 0) {
                console.log(`Updated ${updated}/${variants.length}...`);
            }

            // Rate limit: Scryfall asks for 50-100ms between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
            console.error(`Error updating variant ${variant.id}:`, e);
        }
    }

    console.log(`Updated ${updated} variants.`);
}

updateVariantFields()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

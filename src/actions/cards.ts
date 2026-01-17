
'use server';

import { prisma } from '@/lib/data';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function addCard(formData: FormData) {
    const name = formData.get('name') as string;
    const set = formData.get('set') as string;
    const hareruyaUrl = formData.get('hareruya') as string;
    const cardRushUrl = formData.get('cardrush') as string;
    const bigMagicUrl = formData.get('bigmagic') as string;

    if (!name) return;

    // Create Card
    const card = await prisma.card.create({
        data: {
            name,
            set: set || null,
        }
    });

    // Create Shops if they don't exist (Seed script handled upsert, but just in case)
    // We assume shops exist from migration/seed/scraper logic mostly.
    // But we can just find them by name.

    const shops = await prisma.shop.findMany();
    const hareruya = shops.find(s => s.name === 'Hareruya');
    const cardRush = shops.find(s => s.name === 'CardRush');
    const bigMagic = shops.find(s => s.name === 'BigMagic');

    if (hareruya && hareruyaUrl) {
        await prisma.trackedItem.create({
            data: { cardId: card.id, shopId: hareruya.id, url: hareruyaUrl }
        });
    }

    if (cardRush && cardRushUrl) {
        await prisma.trackedItem.create({
            data: { cardId: card.id, shopId: cardRush.id, url: cardRushUrl }
        });
    }

    if (bigMagic && bigMagicUrl) {
        await prisma.trackedItem.create({
            data: { cardId: card.id, shopId: bigMagic.id, url: bigMagicUrl }
        });
    }

    revalidatePath('/');
    redirect('/');
}

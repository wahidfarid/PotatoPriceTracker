
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
    console.log('Adding test data...');

    // Shops
    const hareruya = await prisma.shop.upsert({
        where: { name: 'Hareruya' },
        update: {},
        create: { name: 'Hareruya', url: 'https://www.hareruyamtg.com/ja/' },
    });

    const cardRush = await prisma.shop.upsert({
        where: { name: 'CardRush' },
        update: {},
        create: { name: 'CardRush', url: 'https://www.cardrush-mtg.jp/' },
    });

    const bigMagic = await prisma.shop.upsert({
        where: { name: 'BigMagic' },
        update: {},
        create: { name: 'BigMagic', url: 'https://www.bigweb.co.jp/' },
    });

    // Card
    const sheoldred = await prisma.card.create({
        data: {
            name: 'Sheoldred, the Apocalypse',
            set: 'Dominaria United',
        }
    });

    // Tracked Items
    await prisma.trackedItem.create({
        data: {
            cardId: sheoldred.id,
            shopId: hareruya.id,
            url: 'https://www.hareruyamtg.com/ja/products/detail/116933', // Hareruya JP
        }
    });

    await prisma.trackedItem.create({
        data: {
            cardId: sheoldred.id,
            shopId: cardRush.id,
            url: 'https://www.cardrush-mtg.jp/product/230886', // CardRush
        }
    });

    console.log('Test data added.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

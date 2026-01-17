
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()

async function main() {
    const shops = [
        { name: 'Hareruya', url: 'https://www.hareruyamtg.com/ja/' },
        { name: 'BigMagic', url: 'https://www.bigweb.co.jp/' },
        { name: 'CardRush', url: 'https://www.cardrush-mtg.jp/' },
    ]

    for (const shop of shops) {
        await prisma.shop.upsert({
            where: { name: shop.name },
            update: {},
            create: shop,
        })
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })

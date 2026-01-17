
import { Shop, TrackedItem, Price, PrismaClient } from '@prisma/client';

export async function scrapeHareruya(
    items: (TrackedItem & { shop: Shop; card: { name: string } })[],
    prisma: PrismaClient
) {
    console.log(`[Hareruya] Scraping ${items.length} items...`);

    // Group by search query if we were doing search, but here we likely have specific items.
    // However, Hareruya API is search-based.
    // Strategy: 
    // 1. If we have a URL, extract the product ID.
    // 2. Query the API for that product ID (using &fq.product=ID or kw=ID).
    // 3. Update price.

    for (const item of items) {
        try {
            const productId = extractProductId(item.url);
            if (!productId) {
                console.error(`[Hareruya] Could not extract ID from ${item.url}`);
                continue;
            }

            // Hareruya API - Search by name, then find ID
            // https://www.hareruyamtg.com/ja/products/search/unisearch_api?kw=NAME&fq.price=1%7E%2A
            const apiUrl = `https://www.hareruyamtg.com/ja/products/search/unisearch_api?kw=${encodeURIComponent(item.card.name)}&fq.price=1%7E%2A&rows=30&page=1`;

            const res = await fetch(apiUrl);
            if (!res.ok) throw new Error(`API returned ${res.status}`);

            const json = await res.json();
            const docs = json.response?.docs || [];

            // Find matching product ID
            const doc = docs.find((d: any) => d.product === productId);

            if (!doc) {
                console.log(`[Hareruya] No result for ID ${productId} (searched for ${item.card.name})`);
                continue;
            }

            // Verify it's the right product if possible, but basic ID match is strong.
            // Price is in `price`. 
            // Hareruya doesn't list BUY (買取) price in this API usually, unless it's a specific Kaitori API.
            // The user asked for "how much the shop is willing to buy the card for (買取)".
            // Usually shops have a separate Kaitori site or page. 
            // Hareruya has https://www.hareruyamtg.com/ja/purchase/
            // Maybe we need to scrape that for Buy Price?
            // Let's implement Sell Price first.

            const priceYen = parseInt(doc.price);

            console.log(`[Hareruya] ${item.card.name}: ${priceYen} Yen`);

            await prisma.price.create({
                data: {
                    trackedItemId: item.id,
                    shopId: item.shopId,
                    priceYen: priceYen,
                    buyPriceYen: null, // TODO: Implement Kaitori scraping
                }
            });

        } catch (e) {
            console.error(`[Hareruya] Error scraping ${item.id}:`, e);
        }
    }
}

function extractProductId(url: string): string | null {
    // https://www.hareruyamtg.com/ja/products/detail/12345
    const match = url.match(/\/detail\/(\d+)/);
    return match ? match[1] : null;
}

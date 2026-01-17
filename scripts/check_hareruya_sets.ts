
import fetch from 'node-fetch';

async function main() {
    const queries = ['[ECC]', '[SPG]', 'Lorwyn Eclipsed Commander'];

    for (const q of queries) {
        const url = `https://www.hareruyamtg.com/ja/products/search/unisearch_api?kw=${encodeURIComponent(q)}`;
        try {
            const res = await fetch(url);
            const json = await res.json();
            const docs = json.response?.docs || [];
            console.log(`Query "${q}" found ${docs.length} items. First 3:`);
            docs.slice(0, 3).forEach((d: any) => {
                console.log(`  - ${d.product_name}`);
            });
        } catch (e) {
            console.error(e);
        }
    }
}
main();

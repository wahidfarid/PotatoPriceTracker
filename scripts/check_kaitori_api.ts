// Native fetch available in Node 18+

async function main() {
  const query = "ローウィン";
  const variants = [
    `https://www.hareruyamtg.com/ja/purchase/product/search/unisearch_api?kw=${encodeURIComponent(query)}`,
    `https://www.hareruyamtg.com/ja/purchase/search/unisearch_api?kw=${encodeURIComponent(query)}`,
    `https://www.hareruyamtg.com/ja/products/search/unisearch_api?kw=${encodeURIComponent(query)}&category=purchase`, // IDK?
  ];

  for (const url of variants) {
    console.log(`Checking API: ${url}`);
    try {
      const res = await fetch(url);
      console.log(`Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          console.log("JSON Response found!", Object.keys(json));
          if (json.response?.numFound > 0) {
            console.log("Items found:", json.response.numFound);
            // Is it purchase price?
            console.log(
              "Sample:",
              JSON.stringify(json.response.docs[0], null, 2),
            );
          }
        } catch (e) {
          console.log("Not JSON");
        }
      }
    } catch (e: any) {
      console.error("Fetch error:", e.message);
    }
    console.log("---");
  }
}

main();

import fetch from "node-fetch";

async function main() {
  const query = "Lorwyn Eclipsed";
  // or "ローウィン・エクリプス"
  // Try both

  const queries = ["Lorwyn Eclipsed", "ローウィン・エクリプス", "Lorwyn"];

  for (const q of queries) {
    console.log(`Checking API for: ${q}`);
    const url = `https://www.hareruyamtg.com/ja/products/search/unisearch_api?kw=${encodeURIComponent(q)}&rows=10&page=1`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`Error ${res.status}`);
        continue;
      }
      const json = await res.json();
      // console.log(JSON.stringify(json, null, 2));
      console.log(`Found ${json.response?.numFound} items.`);
      if (json.response?.docs?.length > 0) {
        console.log(
          "Sample item:",
          JSON.stringify(json.response.docs[0], null, 2),
        );
      }
    } catch (e) {
      console.error(e);
    }
  }
}

main();

import fetch from "node-fetch";

async function main() {
  const ids = ["187479", "112659", "113271", "186585"]; // 186585 is correct Heirloom Auntie

  console.log("Checking Hareruya Product IDs...");

  for (const id of ids) {
    const url = `https://www.hareruyamtg.com/ja/products/detail/${id}`;
    // fetching detail page requires HTML parsing, but let's see if we can get title from <title> tag.
    try {
      const res = await fetch(url);
      const text = await res.text();
      const titleMatch = text.match(/<title>(.*?)<\/title>/);
      if (titleMatch) {
        console.log(`ID ${id}: ${titleMatch[1].trim()}`);
      } else {
        console.log(`ID ${id}: No title found`);
      }
    } catch (e) {
      console.error(`ID ${id}: Error ${e.message}`);
    }
  }
}

main();

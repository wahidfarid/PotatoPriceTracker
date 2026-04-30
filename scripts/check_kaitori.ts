import fetch from "node-fetch";

async function main() {
  // Hareruya Purchase (Kaitori) site usually shares similar API structure or has its own.
  // URL: https://www.hareruyamtg.com/ja/purchase/
  // Search API?
  // Inspecting network traffic for "Lorwyn" on purchase site would be ideal.
  // Let's guess/try unisearch_api on purchase path or similar.

  // Common Hareruya Purchase Search:
  // https://www.hareruyamtg.com/ja/purchase/product/search?product=...

  const query = "ローウィン";
  console.log(`Checking Kaitori for: ${query}`);

  // Try to find if there is an API endpoints.
  // Often it's just HTML scraping for Kaitori if API is hidden.
  // But let's try to fetch the HTML search page first.

  const url = `https://www.hareruyamtg.com/ja/purchase/product/search?product=${encodeURIComponent(query)}`;

  const res = await fetch(url);
  console.log(`Status: ${res.status}`);
  const html = await res.text();

  if (html.includes("itemPrice")) {
    console.log("Found itemPrice class in HTML.");
    // Simple regex check for a price
    const priceMatch = html.match(/<p class="itemPrice">([\s\S]*?)<\/p>/);
    if (priceMatch) {
      console.log("Sample Price found:", priceMatch[1].trim());
    }

    // Check for item names
    if (html.includes("Lorwyn")) {
      console.log('Found "Lorwyn" in response.');
    }
  } else {
    console.log("Did not find standard itemPrice structure.");
  }
}

main();

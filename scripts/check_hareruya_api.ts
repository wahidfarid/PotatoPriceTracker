async function main() {
  const url =
    "https://www.hareruyamtg.com/ja/products/search/unisearch_api?kw=Sheoldred&fq.price=1%7E%2A&rows=5&page=1";
  console.log("Fetching:", url);
  const res = await fetch(url);
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response length:", text.length);
  try {
    const json = JSON.parse(text);
    console.log("JSON keys:", Object.keys(json));
    console.log(
      "Sample item:",
      JSON.stringify(json[0] || json.items?.[0] || json, null, 2),
    );
  } catch (e) {
    console.log("Not JSON. First 500 chars:", text.slice(0, 500));
  }
}

main();

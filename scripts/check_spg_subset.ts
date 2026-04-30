import fetch from "node-fetch";

async function main() {
  // Query to isolate Lorwyn Eclipsed Special Guests
  // Hypothesis: Released in 2026

  const query = "set:spg year:2026";
  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=prints`;

  console.log(`Querying: ${query}`);

  try {
    const res = await fetch(url);
    const json = await res.json();
    const data = json.data || [];

    console.log(`Found ${data.length} SPG cards in 2026.`);

    const slice = data.slice(0, 5);
    slice.forEach((d: any) => {
      console.log(`\nName: ${d.name}`);
      console.log(`CN: ${d.collector_number}`);
      console.log(`Released: ${d.released_at}`);
    });
  } catch (e) {
    console.error(e);
  }
}
main();

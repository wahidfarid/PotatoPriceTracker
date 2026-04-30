import fetch from "node-fetch";

async function main() {
  const oracleId = "48a773d0-c433-4463-b50f-b6d4604a042c"; // Abigale

  // Try to find the Japanese version
  const url = `https://api.scryfall.com/cards/search?q=oracle_id:${oracleId}+lang:ja`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    const data = json.data || [];

    if (data.length > 0) {
      console.log(`Found ${data.length} Japanese prints.`);
      data.forEach((d: any) => {
        console.log(`- ${d.name} (Printed Name: ${d.printed_name})`);
      });
    } else {
      console.log("No Japanese prints found on Scryfall.");
    }
  } catch (e) {
    console.error(e);
  }
}
main();

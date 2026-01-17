
import fetch from 'node-fetch';

async function main() {
    const sets = ['ecc', 'spg']; // potential codes

    for (const code of sets) {
        const url = `https://api.scryfall.com/sets/${code}`;
        try {
            const res = await fetch(url);
            const json = await res.json();
            if (json.object === 'set') {
                console.log(`Found Set: [${json.code.toUpperCase()}] ${json.name} (${json.card_count} cards)`);

                // Check for ECL related cards in SPG if it exists
                if (code === 'spg') {
                    const searchUrl = `https://api.scryfall.com/cards/search?q=set:spg+cn>=63`; // Try to find recent ones? Or check block?
                    // Better: just list cards in SPG and see if they look like Lorwyn ones?
                    // Actually, Special Guests are usually just reprinting fast.
                    // User said "SPG-ECL". Maybe they mean SPG cards *associated* with ECL.
                    console.log('SPG exists. Note: Special Guests are one big set usually.');
                }
            } else {
                console.log(`Set [${code.toUpperCase()}] NOT found.`);
            }
        } catch (e) {
            console.error(e.message);
        }
    }
}

main();


import { runScraper } from '../src/scraper';

// Get source from command line args (e.g., npm run scrape -- hareruya)
const source = process.argv[2] as 'hareruya' | 'cardrush' | undefined;

if (source && source !== 'hareruya' && source !== 'cardrush') {
    console.error(`Invalid source: ${source}`);
    console.error('Usage: npm run scrape [hareruya|cardrush]');
    process.exit(1);
}

runScraper(source).catch(console.error);

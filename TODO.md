# TODO

## Improvements

- [ ] **Improve CardRush scraping reliability** — CardRush anti-bot measures cause frequent timeouts and incomplete scrapes. Most cards in the bulk price view show `—` for CardRush columns because prices are too sparse. Investigate rotating user-agents, request throttling, or an alternative fetch strategy (e.g. Playwright with stealth plugin).

## Bugs

- [ ] **Unawaited `prisma.cardVariant.create()` in `src/scraper/shops/cardrush_set.ts:146`**
      The on-the-fly variant creation uses `.then()/.catch()` instead of `await`, so the newly created variant won't exist in the local lookup maps in time for the current page's price matching. This is a race condition — prices for new finish types (e.g., surge foil) discovered by CardRush may silently fail to match on their first scrape run. Fix: add `await` like `hareruya_set.ts:115` already does.

# TODO

## Bugs

- [ ] **Unawaited `prisma.cardVariant.create()` in `src/scraper/shops/cardrush_set.ts:146`**
      The on-the-fly variant creation uses `.then()/.catch()` instead of `await`, so the newly created variant won't exist in the local lookup maps in time for the current page's price matching. This is a race condition — prices for new finish types (e.g., surge foil) discovered by CardRush may silently fail to match on their first scrape run. Fix: add `await` like `hareruya_set.ts:115` already does.

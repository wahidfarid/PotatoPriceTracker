# Project Context: Potato Price Tracker (MTG)

## Overview

A specialized price tracking application for Magic: The Gathering, currently tracking:

- **Lorwyn Eclipsed**: ECL (main), ECC (Commander), SPG (restricted, year:2026 filter)
- **TMNT Universes Beyond** (released 2026-03-06): TMT (main, ~320 cards), TMC (Commander, ~132 cards), PZA (masterpiece, 20 cards)
- **Secrets of Strixhaven** (released 2026-04-24): SOS (main), SOC (Commander), SOA (Mystical Archive)

## Core Tech Stack

- **Framework**: Next.js 16+ (App Router)
- **Database**: Prisma with SQLite (`prisma/dev.db`)
- **Scraping**: Playwright & Node Fetch (custom scrapers in `src/scraper`)
- **Styling**: Vanilla CSS / Tailwind (mostly Tailwind for UI components)
- **Testing**: Vitest 2 (unit + component + API; two workspace projects: `unit-node` / `unit-jsdom`), Playwright (E2E, Chromium only, specs in `e2e/`)
- **Formatting**: Prettier 3 + eslint-config-prettier
- **Pre-commit**: husky + lint-staged (ESLint + Prettier on staged files, then `tsc --noEmit`)
- **CI**: 4 parallel GitHub Actions jobs — `lint-typecheck-format`, `test` (uploads coverage artifact), `build`, `e2e`

## Domain Logic

1. **Canonical Data**: Scryfall is the source of truth for Card Names, Collector Numbers, and Oracle IDs. Cards are seeded from Scryfall via `scripts/seed_scryfall.ts`.
2. **Matching Strategy**:
   - Primary: **Collector Number + Set Code + Language + Foil status**.
   - Fallback: **Card Name (exact English) + Set Code + Language + Foil status**.
   - _Note_: collector numbers are normalized (e.g., `052` -> `52`) to match between Hareruya and DB.
3. **Variants**: Every card has 4 variants in the DB: EN/JP and Foil/Non-Foil.
4. **Shops**:
   - **Hareruya**: Active full-set scraper (`hareruya_set.ts`). Tracks **Buying** (Shop's Selling Price) and **Selling** (Shop's Kaitori/Buyback Price) + Stock levels.
   - **CardRush**: Implementation started but suffers from timeouts/anti-bot.

## Database Schema

- `Card`: abstract card entity (Name, OracleID, **nameJa** — Japanese printed name from Scryfall, null if no JP printing exists yet).
- `CardVariant`: concrete print (Set, CN, Lang, Foil, ScryfallID, Image).
- `Price`: point-in-time snapshot (Price, BuyPrice, Stock, Timestamp).

## Current Status

- Large thumbnails enabled (w-44).
- Search bar supports English name, Japanese name, and set code + collector number (e.g. `SOS 42`); has history dropdown and autocomplete.
- Red price coloring for out-of-stock items.
- EN/JP language switcher in the header (persisted in `localStorage` under `pt-lang`). All UI text and card names switch language. i18n strings live in `src/lib/i18n.ts`; context/hook in `src/lib/LanguageContext.tsx`.
- Set tab navigation shows a loading spinner and dims the card list while the new set loads.
- Support for ECL, ECC, SPG (year:2026), TMT, TMC, PZA, SOS, SOC, and SOA.
- **Deployment**: Turso (libSQL) in production; local `prisma/dev.db` (SQLite) for development. Data layer in `src/lib/data.ts` uses `unstable_cache` with a 24h TTL keyed by set code. **No Prisma migration files exist** — always use `prisma db push` to sync schema to local SQLite. Never use `prisma migrate deploy` (it silently no-ops without migration files, leaving tables uncreated).
- **Bulk Price Lookup** (`/bulk`): Page accepting MTG Arena-format deck lists (paste text or import Moxfield `.csv`). Parses `qty name (SET) CN *F*` tokens, matches against all tracked sets, returns per-card prices (Hareruya + CardRush Buy/Sell) sorted by max kaitori × qty desc. Moxfield CSV `Language` column is read and used to prefer EN/JP variants. Inline variant picker for ambiguous name-only matches. Sideboard entries merged by variant. Key files: `src/lib/bulk-parser.ts`, `src/components/BulkPricer.tsx`, `src/app/api/bulk-price/route.ts`.

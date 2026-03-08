# Project Context: Potato Price Tracker (MTG)

## Overview
A specialized price tracking application for Magic: The Gathering, currently tracking:
- **Lorwyn Eclipsed**: ECL (main), ECC (Commander), SPG (restricted, year:2026 filter)
- **TMNT Universes Beyond** (released 2026-03-06): TMT (main, ~320 cards), TMC (Commander, ~132 cards), PZA (masterpiece, 20 cards)

## Core Tech Stack
- **Framework**: Next.js 16+ (App Router)
- **Database**: Prisma with SQLite (`prisma/dev.db`)
- **Scraping**: Playwright & Node Fetch (custom scrapers in `src/scraper`)
- **Styling**: Vanilla CSS / Tailwind (mostly Tailwind for UI components)

## Domain Logic
1. **Canonical Data**: Scryfall is the source of truth for Card Names, Collector Numbers, and Oracle IDs. Cards are seeded from Scryfall via `scripts/seed_scryfall.ts`.
2. **Matching Strategy**:
   - Primary: **Collector Number + Set Code + Language + Foil status**.
   - Fallback: **Card Name (exact English) + Set Code + Language + Foil status**.
   - *Note*: collector numbers are normalized (e.g., `052` -> `52`) to match between Hareruya and DB.
3. **Variants**: Every card has 4 variants in the DB: EN/JP and Foil/Non-Foil.
4. **Shops**: 
   - **Hareruya**: Active full-set scraper (`hareruya_set.ts`). Tracks **Buying** (Shop's Selling Price) and **Selling** (Shop's Kaitori/Buyback Price) + Stock levels.
   - **CardRush**: Implementation started but suffers from timeouts/anti-bot.

## Database Schema
- `Card`: abstract card entity (Name, OracleID).
- `CardVariant`: concrete print (Set, CN, Lang, Foil, ScryfallID, Image).
- `Price`: point-in-time snapshot (Price, BuyPrice, Stock, Timestamp).

## Current Status
- Large thumbnails enabled (w-44).
- Fixed search bar (English only).
- Red price coloring for out-of-stock items.
- Support for ECL, ECC, SPG (year:2026), TMT, TMC, and PZA.
- **Deployment**: Static SQLite hosting on Vercel with absolute path resolution in `src/lib/data.ts`.

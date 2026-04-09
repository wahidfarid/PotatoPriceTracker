# Potato Price Tracker 🥔

> **Work in progress** — features are actively being added and things may break. See [TODO.md](./TODO.md) for known issues and planned work.

A Magic: The Gathering card price tracker focused on Japanese card shops. It scrapes buying and selling prices from Hareruya and CardRush, stores historical snapshots, and displays them in a searchable dashboard with 30-day trend charts.

---

## Features

- **Multi-shop price tracking** — Hareruya and CardRush (JP)
- **Buying & selling prices** — tracks both kaitori (buyback) and retail prices per shop
- **Multiple MTG sets** — Lorwyn Eclipsed (ECL, ECC, SPG) and TMNT Universes Beyond (TMT, TMC, PZA)
- **Card variants** — EN/JP × foil finish (nonfoil, surgefoil, etched foil, fracture foil)
- **30-day price sparklines** — aggregated trend per card variant across shops
- **Card images** — loaded from Scryfall, with full-size modal on click
- **Search** — filter by English card name

---

## Tech Stack

- **Next.js** (App Router) + React + Tailwind CSS
- **Prisma** ORM — SQLite locally, Turso in production
- **Playwright** + Cheerio — scraping
- **Recharts** — sparkline charts
- **Scryfall** — canonical card data source

---

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

---

## Running the Scraper

Fetch the latest prices from all configured shops and sets (ECL, ECC, SPG, TMT, TMC, PZA):

```bash
npx tsx scripts/run-scraper.ts
```

---

## Agent / IDE Rules

- Canonical project context + agent collaboration rules live in `.agent/` (`.agent/context.md`, `.agent/rules.md`).
- Cursor mirrors those rules in `.cursor/rules/` for repo-local rule loading.

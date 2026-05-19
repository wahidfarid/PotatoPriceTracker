# Architecture

Technical diagrams of how PotatoPriceTracker is wired together. All diagrams are Mermaid and render on GitHub.

## 1. System topology

End-to-end view: data sources, runtime, storage, and automation.

```mermaid
flowchart LR
    subgraph External["External sources"]
        SF["Scryfall API<br/>(card metadata, JP names)"]
        HR["Hareruya<br/>(unisearch_api + HTML)"]
        CR["CardRush<br/>(HTML + JSON API)"]
    end

    subgraph GHA["GitHub Actions"]
        Daily["daily-scrape.yml<br/>cron 00:07 UTC"]
        Seed["seed-scryfall.yml<br/>workflow_dispatch"]
        CI["ci.yml<br/>lint · test · build · e2e"]
    end

    subgraph Vercel["Vercel (Next.js 16 App Router)"]
        Pages["/ · /bulk"]
        API["/api/* routes"]
        Cache[("Next.js Data Cache<br/>unstable_cache<br/>tag: dashboard-data<br/>TTL 24h")]
    end

    subgraph DB["Turso (libSQL) — prod<br/>SQLite prisma/dev.db — local"]
        Card[(Card)]
        Variant[(CardVariant)]
        Price[(Price)]
        Shop[(Shop)]
    end

    User(("Browser")) --> Pages
    Pages --> Cache
    API --> Cache
    Cache -- miss --> DB
    Pages -. SSR/CSR .-> API

    Seed --> SF
    SF --> Seed
    Seed --> Card
    Seed --> Variant

    Daily --> HR
    Daily --> CR
    HR --> Daily
    CR --> Daily
    Daily --> Price
    Daily -- "POST /api/revalidate<br/>x-revalidate-secret" --> API
    API -- "revalidateTag" --> Cache

    CI -. on push/PR .-> Vercel
```

## 2. Read path — dashboard

How a page render resolves card data.

```mermaid
sequenceDiagram
    participant U as User
    participant P as app/page.tsx<br/>(RSC)
    participant D as src/lib/data.ts
    participant C as unstable_cache<br/>tag: dashboard-data
    participant PR as Prisma client
    participant T as Turso / SQLite

    U->>P: GET /?set=TMT
    P->>D: getDashboardData("TMT")
    D->>C: cache lookup [dashboard-data, "TMT"]
    alt cache hit
        C-->>D: gzip+base64 blob
    else miss
        D->>PR: 3× raw SQL (latest price,<br/>30d sparkline, max ts)
        PR->>T: libSQL/SQLite query<br/>(flat IN-list, no correlated subq)
        T-->>PR: rows
        PR-->>D: rows
        D->>D: stitch + JSON.stringify + gzip
        D->>C: store
    end
    D-->>P: { cards, lastUpdated }
    P-->>U: HTML + hydration
    U->>P: client search/filter (CardList)
```

## 3. Write path — daily scrape

How prices land in the database every day.

```mermaid
sequenceDiagram
    participant Cron as GitHub Actions<br/>daily-scrape (00:07 UTC)
    participant Run as scripts/run-scraper.ts
    participant HSet as hareruya_set.ts<br/>(Buying)
    participant HKai as hareruya_kaitori.ts<br/>(Selling)
    participant CSet as cardrush_set.ts
    participant CKai as cardrush_kaitori.ts
    participant V as CardVariant lookup<br/>(CN+lang+finish → name fallback)
    participant DB as Turso (Price table)
    participant Rev as POST /api/revalidate

    Cron->>Run: npx tsx run-scraper.ts
    par Hareruya
        Run->>HSet: unisearch_api(setCode)
        HSet->>V: match each row
        V-->>HSet: variantId
        HSet->>DB: INSERT Price (priceYen, stock, sourceUrl, ts)
        Run->>HKai: kaitori HTML
        HKai->>V: match
        HKai->>DB: UPSERT buyPriceYen on recent Price
    and CardRush
        Run->>CSet: HTML scrape
        CSet->>V: match
        CSet->>DB: INSERT Price
        Run->>CKai: JSON API
        CKai->>DB: UPSERT buyPriceYen
    end
    Run->>Rev: x-revalidate-secret
    Rev->>Rev: revalidateTag("dashboard-data")<br/>revalidatePath("/")
    Note over Cron: Discord webhook on failure
```

## 4. Data model

Three core entities plus Shop. `CardVariant` is keyed on `(setCode, collectorNumber, language, finish)`.

```mermaid
erDiagram
    Card ||--o{ CardVariant : "has variants"
    CardVariant ||--o{ Price : "snapshots"
    Shop ||--o{ Price : "source"

    Card {
        string id PK
        string name
        string nameJa "nullable; from Scryfall lang:ja"
        string oracleId
    }
    CardVariant {
        string id PK
        string cardId FK
        string scryfallId
        string setCode "ECL, TMT, SOS, …"
        string collectorNumber "normalized, no leading zero"
        string language "EN | JP"
        bool   isFoil
        string finish "nonfoil | foil | surgefoil | etchedfoil | …"
        string image
        string frameEffects
        string promoTypes
    }
    Price {
        string   id PK
        string   variantId FK
        string   shopId FK
        int      priceYen "shop selling (Buying)"
        int      buyPriceYen "shop kaitori (Selling)"
        int      stock
        string   sourceUrl
        string   sellSourceUrl
        datetime timestamp
    }
    Shop {
        string id PK
        string name "Hareruya | CardRush | BigMagic"
        string url
    }
```

## 5. Bulk pricing flow

`/bulk` deck-list lookup — independent path from the dashboard.

```mermaid
flowchart TD
    Paste["Paste Arena text<br/>or Moxfield CSV"] --> Parser["src/lib/bulk-parser.ts<br/>parseDeckList / parseMoxfieldCsv"]
    Parser -->|ParsedLine[]| API["POST /api/bulk-price"]

    API --> Match{Token-locked?<br/>setCode + CN present}
    Match -->|yes| Lock["Lock to variant<br/>by CN+set, prefer lang/finish"]
    Match -->|no| Name["Match by name<br/>(EN + nameJa, case-insensitive)"]

    Lock --> Latest["Fetch latest Price per shop<br/>(single IN-list raw SQL)"]
    Name --> Latest

    Latest --> Sort["Sort by max(buyPriceYen) × qty DESC<br/>notFound last"]
    Sort --> Rows["ResolvedRow[]"]
    Rows --> UI["BulkPricer component<br/>variant chip + per-shop buy/sell"]
```

## 6. Dual-mode Prisma client

How `src/lib/prisma.ts` picks an adapter at runtime.

```mermaid
flowchart LR
    Start(["import prisma"]) --> Check{DATABASE_URL<br/>starts with file:?}
    Check -->|yes — local dev| Sqlite["new PrismaClient()<br/>→ prisma/dev.db"]
    Check -->|no — production| Libsql["PrismaLibSQL adapter<br/>+ createClient({<br/>  url: TURSO_DATABASE_URL,<br/>  authToken: TURSO_AUTH_TOKEN<br/>})"]
    Sqlite --> Global[(global singleton<br/>dev hot-reload safe)]
    Libsql --> Global
```

## 7. CI pipeline

Four parallel jobs on push/PR.

```mermaid
flowchart LR
    Push["git push / PR"] --> Trigger((ci.yml))
    Trigger --> J1["lint-typecheck-format<br/>ESLint · Prettier · tsc --noEmit"]
    Trigger --> J2["test<br/>vitest workspace<br/>(unit-node + unit-jsdom)<br/>↑ coverage artifact"]
    Trigger --> J3["build<br/>next build<br/>DATABASE_URL=file:./prisma/dev.db"]
    Trigger --> J4["e2e<br/>prisma db push + seed.ts<br/>playwright (Chromium)"]

    PreCommit["husky pre-commit"] -. local .- L1["lint-staged<br/>ESLint+Prettier on staged"]
    PreCommit -. local .- L2["tsc --noEmit"]
```

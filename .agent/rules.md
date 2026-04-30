# AI Collaboration Rules & Style Guidelines

These rules are derived from the user's feedback and preferred interaction style.

## 1. Surgical Edits

- All changes must be as surgical and minimal as possible.
- Avoid extra flourishes or adding features not explicitly requested.
- Do not refactor entire files if a 5-line edit suffices.

## 2. Communication

- If in doubt, **always ask for clarification** before making destructive changes or large architectural shifts.
- Keep artifact summaries and walkthroughs concise.
- Acknowledge mistakes or backtracking clearly but briefly.
- **No Looping**: If you find yourself repeating the same actions or getting stuck, immediately stop, explain why the current approach is failing, and ask for clarification. Do not loop.
- **Investigation Transparency**: Always explain the "why" behind an investigation step if it takes more than one attempt.

## 3. Tech & Code Style

- **Canonical Source**: Scryfall is the ONLY source for card names. Do not pull names from shop titles (like Hareruya's bilingual titles).
- **UI Aesthetics**: User prefers clean, dense, but readable UI.
  - Base text size should be `text-sm` (slightly larger than standard Next.js default).
  - Use fixed headers/search bars for navigation in large lists.
- **Commenting**: Do not add code comments unless explicitly requested.
- **Stability**: When doing any code changes, always avoid regressions. The pre-commit hook automatically runs lint-staged (ESLint + Prettier on staged files) and `tsc --noEmit` on every commit. Before suggesting a deployment, also run `npm run test:run` and `npm run build` to catch anything the hook doesn't cover.
- **Terminology**: Use customer-centric labels in UI: **Buying** (Price paid to shop) and **Selling** (Price received from shop).

## 4. Workflows

- **Seeding**: Always verify set codes on Scryfall before updating the seeder.
  - JP names are fetched in one bulk Scryfall search per set (`set:xxx+lang:ja+unique:prints`), not per card. Only `printed_name` is stored — never fall back to `name` (which is always English). Re-running the seeder backfills any card where `nameJa IS NULL`, so it is safe to re-run after Scryfall adds new JP data.
  - After seeding, clear `.next/cache` locally and `POST /api/revalidate` in production to flush the 24h gzip cache.
- **Turso SQL — avoid correlated subqueries**: A pattern like `WHERE p.timestamp = (SELECT MAX(p2.timestamp) WHERE p2.variantId = p.variantId ...)` re-executes the subquery for every outer row, causing a full table scan and multi-minute hangs. Use a flat `WHERE variantId IN (...)` query (the existing `@@index([variantId])` on Price makes this fast) and deduplicate in JS, or a single `GROUP BY` pass in a derived table. Never use a correlated subquery against the Price table.
- **Schema changes**: `prisma db push` only updates local SQLite (`prisma/dev.db`). Turso requires a separate migration — either `turso db shell <db-name> "ALTER TABLE ..."` (requires `turso auth login`) or via the libsql client directly using env credentials. Always do both.
- **Scraping**: Normalize collector numbers (remove leading zeros) for matching.
- **Testing**: Use debug scripts (e.g., `scripts/debug_*.ts`) to isolate matching issues before running full-set crawls.
- **ESLint scope**: `npm run lint` only covers `src/`. The `scripts/` directory is excluded via `globalIgnores` in `eslint.config.mjs` and lint-staged respects this. Do not add `scripts/` to any lint step.

## 5. Artifact Usage

- Use Claude's built-in plan mode for major changes (plan file is created automatically; wait for user approval before implementing).
- For minor changes, proceed directly with a brief explanation.

## 6. Knowledge Maintenance

- If the user provides clear context or preferences, **ask for permission** before adding that information to `.agent/context.md` or `.agent/rules.md`.
- After updating these files with permission, recap the changes to confirm.

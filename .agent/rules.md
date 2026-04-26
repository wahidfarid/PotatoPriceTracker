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
- **Stability**: When doing any code changes, always avoid regressions. **Always run `npm run build` locally** to verify TypeScript integrity before suggesting a deployment.
- **Terminology**: Use customer-centric labels in UI: **Buying** (Price paid to shop) and **Selling** (Price received from shop).

## 4. Workflows

- **Seeding**: Always verify set codes on Scryfall before updating the seeder.
  - JP names are fetched in one bulk Scryfall search per set (`set:xxx+lang:ja+unique:prints`), not per card. Only `printed_name` is stored — never fall back to `name` (which is always English). Re-running the seeder backfills any card where `nameJa IS NULL`, so it is safe to re-run after Scryfall adds new JP data.
  - After seeding, clear `.next/cache` locally and `POST /api/revalidate` in production to flush the 24h gzip cache.
- **Schema changes**: `prisma db push` only updates local SQLite (`prisma/dev.db`). Turso requires a separate migration — either `turso db shell <db-name> "ALTER TABLE ..."` (requires `turso auth login`) or via the libsql client directly using env credentials. Always do both.
- **Scraping**: Normalize collector numbers (remove leading zeros) for matching.
- **Testing**: Use debug scripts (e.g., `scripts/debug_*.ts`) to isolate matching issues before running full-set crawls.

## 5. Artifact Usage

- maintain `task.md` with incremental checkbox updates.
- Use `implementation_plan.md` for major changes and wait for approval.
- Provide a `walkthrough.md` after successful verification.

## 6. Knowledge Maintenance

- If the user provides clear context or preferences, **ask for permission** before adding that information to `.agent/context.md` or `.agent/rules.md`.
- After updating these files with permission, recap the changes to confirm.

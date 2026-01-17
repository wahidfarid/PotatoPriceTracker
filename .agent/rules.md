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

## 3. Tech & Code Style
- **Canonical Source**: Scryfall is the ONLY source for card names. Do not pull names from shop titles (like Hareruya's bilingual titles).
- **UI Aesthetics**: User prefers clean, dense, but readable UI. 
  - Base text size should be `text-sm` (slightly larger than standard Next.js default).
  - Use fixed headers/search bars for navigation in large lists.
- **Commenting**: Do not add code comments unless explicitly requested.
- **Stability**: When doing any code changes, always avoid regressions and make sure the existing code before the changes works as expected after the changes.

## 4. Workflows
- **Seeding**: Always verify set codes on Scryfall before updating the seeder.
- **Scraping**: Normalize collector numbers (remove leading zeros) for matching.
- **Testing**: Use debug scripts (e.g., `scripts/debug_*.ts`) to isolate matching issues before running full-set crawls.

## 5. Artifact Usage
- maintain `task.md` with incremental checkbox updates.
- Use `implementation_plan.md` for major changes and wait for approval.
- Provide a `walkthrough.md` after successful verification.

## 6. Knowledge Maintenance
- If the user provides clear context or preferences, **ask for permission** before adding that information to `.agent/context.md` or `.agent/rules.md`.
- After updating these files with permission, recap the changes to confirm.

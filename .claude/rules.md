<!--
Adapted from `.agent/rules.md` for Claude Code.
Source of truth: `.agent/rules.md` (edit that file, then re-mirror here with Claude-specific adaptations).
-->

# AI Collaboration Rules & Style Guidelines

These rules are derived from the user's feedback and preferred interaction style.

## 1. Surgical Edits

- All changes must be as surgical and minimal as possible.
- Avoid extra flourishes or adding features not explicitly requested.
- Do not refactor entire files if a 5-line edit suffices.

## 2. Communication

- If in doubt, **always ask for clarification** before making destructive changes or large architectural shifts.
- Keep explanations concise.
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
- **Scraping**: Normalize collector numbers (remove leading zeros) for matching.
- **Testing**: Use debug scripts (e.g., `scripts/debug_*.ts`) to isolate matching issues before running full-set crawls.

## 5. Task Management (Claude Code)

- Use the TodoWrite tool to track multi-step tasks and provide visibility into progress.
- For major changes, use EnterPlanMode to create an implementation plan and wait for approval before proceeding.
- Mark todos as in_progress when starting work, and completed immediately after finishing each step.

## 6. Knowledge Maintenance

- If the user provides clear context or preferences, **ask for permission** before adding that information to `.agent/context.md` or `.agent/rules.md`.
- After updating these files with permission, recap the changes to confirm.

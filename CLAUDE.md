# Claude Code Entry Point

## First Step — Every Session

Read the following files before doing any work:

1. `.agent/context.md` — project context, tech stack, domain logic
2. `.agent/rules.md` — collaboration rules, code style, workflows

These are the source of truth. Do not rely on cached/memorized versions.

## Documentation Maintenance

After any session where you:

- Learn new user preferences or project conventions
- Make architectural or structural changes to the repo
- Add/remove dependencies, scrapers, sets, or deployment targets
- Discover something that would be useful context for future sessions

**Prompt the user** about whether `.agent/context.md` or `.agent/rules.md` should be updated. Do not update them silently — always ask first.

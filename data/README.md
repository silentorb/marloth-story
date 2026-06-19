# Local query cache

Gitignored SQLite cache rebuilt from `./content/` by `bun run content:sync` or the Tome editor API on startup.

Default path: `data/tome.sqlite` (legacy `data/marloth.sqlite` is still used when present and `tome.sqlite` is absent).

See [`docs/features/tome-db.md`](../docs/features/tome-db.md) and root [`AGENTS.md`](../AGENTS.md) (**Graph data workflow**).

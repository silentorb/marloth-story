# Notion metadata sync

Read-only sync from the Notion web API into `data/marloth.sqlite`. Writes **never** go back to Notion.

## Setup

1. Create a [Notion integration](https://www.notion.so/my-integrations) with read-only access where possible.
2. Share the [Marloth root page](https://www.notion.so/Marloth-72b6fb455b824b78962b0e509cc091c9) and subpages with the integration.
3. Copy [`.devcontainer/notion.env.example`](../../.devcontainer/notion.env.example) to `.devcontainer/notion.env` and set `NOTION_API_KEY`.

## Commands

```bash
# Page timestamps (created_at, modified_at, notion_url)
bun run notion:sync-metadata -- pages

# Database schema + views (notion_schema, notion_views on NotionDatabase vertices)
bun run notion:sync-metadata -- databases

# Options
bun run notion:sync-metadata -- pages --dry-run --limit 5
bun run notion:sync-metadata -- databases --id {32-hex-database-id} --enrich-rows
```

## Read-only API surface

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/v1/pages/{id}` | Page metadata |
| GET | `/v1/databases/{id}` | Database schema |
| GET | `/v1/views` | List views |
| GET | `/v1/views/{id}` | View filters/sorts |
| POST | `/v1/databases/{id}/query` | Read row values (optional `--enrich-rows`) |

No create/update/delete Notion endpoints are used.

## Graph properties

**Pages:** `created_at`, `modified_at`, `notion_url`, optional `notion_archived`

**NotionDatabase vertices:** `notion_schema`, `notion_views`, optional `notion_url`

The editor uses synced database views for filter/sort-aware table rendering when `notion_views` is present; legacy CSV view keys remain the fallback.

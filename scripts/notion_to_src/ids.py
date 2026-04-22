from __future__ import annotations

import re

# Notion uses 32-char hex ids in exported filenames: "Page title abc123def4....md"
_NOTION_32 = re.compile(r" ([a-f0-9]{32})\.(md|csv)(?:#.*)?$", re.IGNORECASE)


def extract_notion_id(filename: str) -> str | None:
    """Return lowercase 32-hex id if present in basename."""
    m = _NOTION_32.search(filename)
    if m:
        return m.group(1).lower()
    return None

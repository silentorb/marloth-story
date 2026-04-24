from __future__ import annotations

import csv
import re
from pathlib import Path

from . import textutil

_ID_VIEW = re.compile(
    r"^(.+?)\s+([a-f0-9]{32})((?:_all(?:_[0-9]+)?)?)\.csv$",
    re.IGNORECASE,
)


def parse_csv_basename(
    name: str,
) -> tuple[str, str, str, str] | None:
    """
    Return (display_name, database_id_hex, view_key, file_stem) or None.
    view_key: 'default' | 'all' | 'all-1' | ...
    """
    m = _ID_VIEW.match(name)
    if not m:
        return None
    display_name, dbid, suff = m.group(1), m.group(2).lower(), m.group(3) or ""
    if not suff:
        view = "default"
    elif suff == "_all":
        view = "all"
    else:
        m2 = re.match(r"^_all_(\d+)$", suff)
        view = f"all-{m2.group(1)}" if m2 else suff.lstrip("_") or "default"
    return display_name, dbid, view, name


def index_out_filename(database_id: str, view: str) -> str:
    vid = database_id.lower()
    v = view.lower().replace("_", "-")
    return f"index-{vid}-{v}.md"


def read_csv_rows(path: Path) -> tuple[list[str], list[list[str]]]:
    with path.open(newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        rows = list(reader)
    if not rows:
        return [], []
    header = [textutil.strip_emojis(h) for h in rows[0]]
    header = textutil.disambiguate_headers(header)
    return header, rows[1:]

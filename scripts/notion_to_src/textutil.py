"""Emoji stripping and YAML-safe key slugs (stdlib only)."""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path

from .ids import extract_notion_id

# Broad emoji and symbol blocks used by Notion property icons; conservative extras for FE0F etc.
_EMOJI_OR_SYMBOL = re.compile(
    "["
    "\U0001F300-\U0001FAFF"  # Misc symbols, supplemental
    "\U0001F600-\U0001F64F"  # Emoticons
    "\U0001F680-\U0001F6FF"  # Transport
    "\U00002600-\U000027BF"  # Misc symbols, dingbats
    "\U00002300-\U000023FF"  # Technical
    "\U0001F1E0-\U0001F1FF"  # Flags
    "\U0000200D"  # ZWJ
    "\U0000FE0F"  # VS16
    "\U0001F3FB-\U0001F3FF"  # Skin tones
    "\U0000E000-\U0000F8FF"  # PUA (sometimes used)
    "]+",
    re.UNICODE,
)

_WS_RE = re.compile(r"\s+")
_KEY_SAFE = re.compile(r"[^a-z0-9_]+")
_RESERVED = frozenset(
    {
        "title",
        "notion_id",
        "aliases",
        "source_export",
        "notion_database",
        "notion_url",
        "tags",
        "type",
        "view",
    }
)


def strip_emojis(s: str) -> str:
    s = _EMOJI_OR_SYMBOL.sub("", s)
    s = s.replace("\u200d", "").replace("\ufe0f", "")
    s = _WS_RE.sub(" ", s).strip()
    return s


def slugify_key(label: str) -> str:
    """Lower snake case for YAML keys; strips emoji first."""
    s = strip_emojis(label)
    s = s.strip().lower()
    s = _KEY_SAFE.sub("_", s)
    s = s.strip("_")
    while "__" in s:
        s = s.replace("__", "_")
    if not s:
        s = "property"
    if s in _RESERVED or s[0].isdigit():
        s = "prop_" + s
    return s


_APOS = "'\u2018\u2019\u201B\u02BC"


def _strip_combining(s: str) -> str:
    nfd = unicodedata.normalize("NFD", s)
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn")


def url_friendly_basename(export_basename: str) -> str:
    """
    Notion export name like "Part 1 2ba5....md" -> "part-1-2ba5....md" (lowercase, hyphens, no apostrophes).
    """
    nid = extract_notion_id(export_basename)
    if not nid:
        raise ValueError(f"no notion id in filename: {export_basename!r}")
    if not export_basename.lower().endswith(".md"):
        raise ValueError(f"expected .md: {export_basename!r}")
    stem = Path(export_basename).stem
    suff = f" {nid}"
    if not stem.lower().endswith(suff.lower()):
        raise ValueError(
            f"title segment before id not found in {export_basename!r}"
        )
    title = stem[: -len(suff)]
    for ch in _APOS:
        title = title.replace(ch, "")
    title = _strip_combining(title)
    title = title.lower()
    title = re.sub(r"\s+", "-", title.strip())
    title = re.sub(r"[^a-z0-9-]+", "-", title)
    title = re.sub(r"-+", "-", title).strip("-")
    slug = title if title else "page"
    return f"{slug}-{nid}.md"


def disambiguate_headers(headers: list[str]) -> list[str]:
    """If duplicate after emoji strip, add _2, _3..."""
    seen: dict[str, int] = {}
    out: list[str] = []
    for h in headers:
        base = strip_emojis(h) or "column"
        n = seen.get(base, 0) + 1
        seen[base] = n
        if n == 1:
            out.append(base)
        else:
            out.append(f"{base}_{n}")
    return out

from __future__ import annotations

import re
import urllib.parse
from pathlib import Path

from . import textutil

# Label (../path%20x.md) or (path/to/y.md#h)
# Relaxed: non-greedy label, path ends in .md or .csv
_NOTION_PAREN_LINK = re.compile(
    r"(?<!\[)([^\[\]\n(]+?)\s*\(\s*([^)]+?\.(?:md|csv))(?:#([^)]*))?\s*\)(?!\])",
    re.IGNORECASE,
)

_HTML_LINK = re.compile(
    r'<a\s+[^>]*href="([^"]+)"[^>]*>([^<]*)</a>', re.IGNORECASE | re.DOTALL
)


def _norm_key(p: Path) -> str:
    return str(p.resolve())


def unquote_path(s: str) -> str:
    s = s.strip()
    if s.startswith("<") and s.endswith(">"):
        s = s[1:-1]
    return urllib.parse.unquote(s)


def build_target_to_output(
    md_sources: list[Path], repo_root: Path
) -> tuple[dict[str, str], dict[str, str]]:
    """
    by_resolved: resolved absolute str -> output basename
    id_to_basename: 32-hex id -> output basename
    """
    by_resolved: dict[str, str] = {}
    id_to: dict[str, str] = {}
    for p in md_sources:
        rp = (repo_root / p).resolve() if not p.is_absolute() else p.resolve()
        key = _norm_key(rp)
        base = textutil.url_friendly_basename(p.name)
        by_resolved[key] = base
        m = re.search(r"([a-f0-9]{32})\.md$", base, re.I)
        if m:
            id_to[m.group(1).lower()] = base
    return by_resolved, id_to


def resolve_target(
    target_raw: str,
    source_file: Path,
    repo_root: Path,
    by_resolved: dict[str, str],
    id_to_basename: dict[str, str],
    csv_to_output: dict[str, str] | None = None,
) -> str | None:
    """Return output basename in src/, or None if unresolvable."""
    target_raw = unquote_path(target_raw)
    if not target_raw or target_raw.startswith(("#", "http://", "https://")):
        return None
    if target_raw.startswith("mailto:"):
        return None

    src = source_file
    if not src.is_absolute():
        src = (repo_root / src).resolve()
    if src.is_file():
        source_dir = src.parent
    else:
        source_dir = src
    tpath = (source_dir / target_raw).resolve()
    tkey = _norm_key(tpath)
    if tkey in by_resolved:
        return by_resolved[tkey]
    if csv_to_output and tkey in csv_to_output:
        return csv_to_output[tkey]
    m = re.search(r"([a-f0-9]{32})(?:\.(?:md|csv))", target_raw, re.I)
    if m and m.group(1).lower() in id_to_basename:
        return id_to_basename[m.group(1).lower()]
    return None


def link_target_basename(
    to_basename: str, anchor: str | None
) -> str:
    a = f"#{anchor}" if anchor else ""
    # same-dir: quote safe
    if " " in to_basename or any(
        c in to_basename for c in '[]()&:' 
    ):  # minimal safe set
        return urllib.parse.quote(to_basename, safe="/%#?&=+-_.!~*'()") + a
    return to_basename + a


def rewrite_notion_links_in_text(
    text: str,
    source_relpath: str,
    repo_root: Path,
    by_resolved: dict[str, str],
    id_to_basename: dict[str, str],
    csv_to_output: dict[str, str] | None = None,
) -> tuple[str, list[str]]:
    """
    source_relpath: path relative to repo root pointing at original .md in external/notion/...
    """
    source_file = (repo_root / source_relpath).resolve()
    out_errs: list[str] = []

    def _repl_paren(m: re.Match) -> str:
        label, path_part = m.group(1).strip(), m.group(2).strip()
        anc = m.group(3) if m.lastindex >= 3 and m.group(3) is not None else None
        p2 = path_part
        to_base = resolve_target(
            p2,
            source_file,
            repo_root,
            by_resolved,
            id_to_basename,
            csv_to_output,
        )
        if not to_base:
            out_errs.append(f"unresolved: {path_part} in {source_relpath}")
            return m.group(0)
        href = link_target_basename(to_base, anc if anc else None)
        return f"[{label}]({href})"

    out = _NOTION_PAREN_LINK.sub(_repl_paren, text)
    return out, out_errs


# Standard markdown [label](url) with repo-relative or ../ path
_MD_LINK = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")


def rewrite_markdown_hrefs(
    text: str,
    source_relpath: str,
    repo_root: Path,
    by_resolved: dict[str, str],
    id_to_basename: dict[str, str],
    csv_to_output: dict[str, str] | None = None,
) -> str:
    source_file = (repo_root / source_relpath).resolve()

    def _r(m: re.Match) -> str:
        label, inner = m.group(1), m.group(2)
        if inner.startswith(("#", "http://", "https://", "mailto:")):
            return m.group(0)
        pathonly, _sep, anchor = inner.partition("#")
        pathonly = unquote_path(pathonly.strip())
        if not pathonly:
            return m.group(0)
        to_base = resolve_target(
            pathonly,
            source_file,
            repo_root,
            by_resolved,
            id_to_basename,
            csv_to_output,
        )
        if not to_base:
            return m.group(0)
        href = link_target_basename(to_base, anchor or None)
        return f"[{label}]({href})"

    return _MD_LINK.sub(_r, text)


def rewrite_all_links(
    text: str,
    source_relpath: str,
    repo_root: Path,
    by_resolved: dict[str, str],
    id_to_basename: dict[str, str],
    csv_to_output: dict[str, str] | None = None,
) -> tuple[str, list[str]]:
    """Iteratively turn Notion paren links and relative markdown links into flat src/ links."""
    errs: list[str] = []
    for _ in range(16):
        prev = text
        text, e = rewrite_notion_links_in_text(
            text, source_relpath, repo_root, by_resolved, id_to_basename, csv_to_output
        )
        errs.extend(e)
        text = rewrite_markdown_hrefs(
            text, source_relpath, repo_root, by_resolved, id_to_basename, csv_to_output
        )
        if text == prev:
            break
    return text, errs

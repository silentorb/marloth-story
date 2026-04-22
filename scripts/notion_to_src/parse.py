from __future__ import annotations

import re
from dataclasses import dataclass

_PROPERTY_LINE = re.compile(r"^(.{1,200}?):\s+(.*)\s*$")


def _is_relation_value(val: str) -> bool:
    v = val.strip()
    if "(" in v and (".md" in v or ".csv" in v):
        return True
    if "(/" in v and (".md" in v or ".csv" in v):
        return True
    return False


@dataclass
class SplitPage:
    h1: str
    h1_text: str
    scalar_properties: list[tuple[str, str]]  # raw key, value (lifted to YAML, not in body)
    body_lines: list[str]  # relation property lines + post-property prose, original order per section


def _is_property_line(line: str) -> bool:
    if not line or line.lstrip().startswith("#"):
        return False
    m = _PROPERTY_LINE.match(line)
    if not m:
        return False
    if ":" in m.group(1):
        return False
    return True


def split_notion_page(text: str) -> SplitPage:
    lines = text.replace("\r\n", "\n").split("\n")
    if not lines:
        return SplitPage("# Untitled", "Untitled", [], [])

    h1 = lines[0]
    h1_text = h1
    m = re.match(r"^#\s+(.*)$", h1)
    if m:
        h1_text = m.group(1).strip()

    i = 1
    while i < len(lines) and not lines[i].strip():
        i += 1

    scalars: list[tuple[str, str]] = []
    relation_and_rest: list[str] = []

    if i < len(lines) and _is_property_line(lines[i]):
        while i < len(lines):
            line = lines[i]
            if not line.strip():
                j = i + 1
                while j < len(lines) and not lines[j].strip():
                    j += 1
                if j < len(lines) and _is_property_line(lines[j]):
                    i = j
                    continue
                break
            if not _is_property_line(line):
                break
            m = _PROPERTY_LINE.match(line)
            assert m
            key, val = m.group(1), m.group(2)
            if _is_relation_value(val):
                relation_and_rest.append(line)
            else:
                scalars.append((key, val))
            i += 1

    relation_and_rest.extend(lines[i:])
    return SplitPage(
        h1=h1,
        h1_text=h1_text,
        scalar_properties=scalars,
        body_lines=relation_and_rest,
    )

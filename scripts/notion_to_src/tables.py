from __future__ import annotations


def escape_cell(s: str) -> str:
    s = s.replace("\n", " ").replace("\r", " ")
    s = s.replace("|", "\\|")
    return s


def gfm_table(headers: list[str], rows: list[list[str]]) -> str:
    w = len(headers)
    if w == 0:
        return ""
    lines = [
        "| " + " | ".join(escape_cell(c) for c in headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    for r in rows:
        rr = [r[i] if i < len(r) else "" for i in range(w)]
        lines.append("| " + " | ".join(escape_cell(c) for c in rr) + " |")
    return "\n".join(lines) + "\n"

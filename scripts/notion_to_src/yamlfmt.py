from __future__ import annotations

import json
from typing import Any, Mapping


def _quote(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def _scalar(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int) and not isinstance(v, bool):
        return str(v)
    if isinstance(v, float):
        if v != v:  # nan
            return "null"
        return repr(v) if (v + 0.0) != int(v) else str(int(v))
    if isinstance(v, str):
        return _quote(v)
    return _quote(str(v))


def format_front_matter(data: Mapping[str, Any]) -> str:
    """Emit YAML front matter without PyYAML: shallow dict, flat lists, scalars."""
    lines: list[str] = ["---"]
    for k, v in data.items():
        if v is None:
            continue
        if isinstance(v, (list, tuple)):
            lines.append(f"{k}:")
            for item in v:
                lines.append(f"  - {_quote(str(item))}")
        else:
            lines.append(f"{k}: {_scalar(v)}")
    lines.append("---")
    return "\n".join(lines) + "\n"

from __future__ import annotations

import argparse
import os
import shutil
import tempfile
import zipfile
import hashlib
import json
import re
import urllib.parse
from pathlib import Path

from . import indexes, textutil, yamlfmt
from .ids import extract_notion_id
from .links import build_target_to_output, rewrite_all_links
from .parse import split_notion_page
from .tables import gfm_table

REPO = Path(__file__).resolve().parent.parent.parent

_PROP_LINE = re.compile(r"^(.{1,200}?):\s+(.*)\s*$")


def _strip_line_key_emojis(line: str) -> str:
    m = _PROP_LINE.match(line)
    if not m:
        return line
    k, v = m.group(1), m.group(2)
    return f"{textutil.strip_emojis(k)}: {v}"


def _primary_alias(title: str, notion_id: str) -> str:
    t = title.strip()
    suff = f" {notion_id}"
    if t.lower().endswith(suff.lower()):
        return t[: -len(suff)]
    m = re.search(r" ([a-f0-9]{32})$", t, re.I)
    if m and m.group(1).lower() == notion_id:
        return t[: m.start()]
    return t


def process_markdown_file(
    abs_md: Path,
    repo_root: Path,
    source_relposix: str,
) -> tuple[str, str, dict]:
    """Return (out_basename, raw_before_links, file_manifest_entry)."""
    # `relposix` (repo-relative source path) must be computed by the caller
    # and injected via `abs_md` being under `repo_root` or an export mapping.
    # This function will still inspect the file name for the notion id.
    text = abs_md.read_text(encoding="utf-8", errors="replace")
    sp = split_notion_page(text)
    nid = extract_notion_id(abs_md.name)
    if not nid:
        raise RuntimeError(f"no notion id in {abs_md}")

    out_name = textutil.url_friendly_basename(abs_md.name)

    fm: dict = {
        "title": sp.h1_text,
        "notion_id": nid,
        "aliases": [_primary_alias(sp.h1_text, nid)],
        "source_export": source_relposix,
    }
    if source_relposix.startswith("external/notion/"):
        rel_under = source_relposix[len("external/notion/") :]
        fm["inferred_notion_path"] = str(Path(rel_under).parent)
    elif source_relposix.startswith("exports/"):
        rel_under = source_relposix[len("exports/") :]
        fm["inferred_notion_path"] = str(Path(rel_under).parent)

    for raw_k, val in sp.scalar_properties:
        key = textutil.slugify_key(raw_k)
        if key in fm:
            key = f"prop_{key}"
        fm[key] = val

    body_lines = [_strip_line_key_emojis(L) for L in sp.body_lines]
    body = "\n".join(body_lines)
    if body.strip():
        body = sp.h1 + "\n\n" + body
    else:
        body = sp.h1

    out = yamlfmt.format_front_matter(fm) + body
    mentry = {
        "notion_id": nid,
        "source_export": source_relposix,
        "inferred_notion_path": fm.get("inferred_notion_path"),
    }
    return out_name, out, mentry


def _plan_index_filename(
    csvp: Path,
    repo_root: Path,
    seen: set[str],
    relposix: str,
) -> tuple[str, object | None, str, str]:
    """
    Return (out_basename, parsed_or_None, vkey, relposix) and update seen.
    """
    parsed = indexes.parse_csv_basename(csvp.name)
    vkey = "unparsed"
    if not parsed:
        h0 = hashlib.sha256(relposix.encode()).hexdigest()[:12]
        out_idx = f"index-{h0}-unparsed.md"
    else:
        _dn, dbid, vkey, _st = parsed
        out_idx = indexes.index_out_filename(dbid, vkey)
    if out_idx in seen:
        h = hashlib.sha256(relposix.encode()).hexdigest()[:8]
        dbpart = parsed[1] if parsed else h
        vk = vkey.replace("_", "-").lower()
        out_idx = f"index-{dbpart}-{vk}-{h}.md"
    seen.add(out_idx)
    return out_idx, parsed, vkey, relposix


def _link_check(src_dir: Path) -> list[str]:
    err: list[str] = []
    for p in sorted(src_dir.glob("*.md")):
        t = p.read_text(encoding="utf-8", errors="replace")
        for m in re.finditer(r"\[[^\]]+\]\(([^)]+)\)", t):
            href = m.group(1).strip()
            if not href or href.startswith(("#", "http://", "https://", "mailto:")):
                continue
            pathonly = href.split("#", 1)[0]
            pathonly = urllib.parse.unquote(pathonly)
            if not pathonly:
                continue
            tgt = (p.parent / pathonly).resolve()
            if not tgt.is_file():
                err.append(f"{p.name}: missing {pathonly}")
    return err


def _make_relposix(abs_p: Path, repo_root: Path, external: Path, source_label: str) -> str:
    try:
        relp = abs_p.resolve().relative_to(repo_root)
        return relp.as_posix()
    except Exception:
        # fall back to a path under the logical source label (e.g. exports/<name>/...)
        rel = abs_p.resolve().relative_to(external)
        return f"{source_label}/{rel.as_posix()}"


def run(
    repo_root: Path,
    clean: bool = False,
    source: Path | None = None,
) -> None:
    # Determine the source directory for Notion exports.
    # Priority: CLI `source` -> env `NOTION_EXPORT_DIR` -> newest file in `./exports` -> fallback `external/notion`.
    env_src = os.environ.get("NOTION_EXPORT_DIR")
    if source:
        src_path = source
    elif env_src:
        src_path = Path(env_src)
    else:
        exports_dir = repo_root / "exports"
        src_path = None
        if exports_dir.is_dir():
            # find newest entry in exports
            entries = [p for p in exports_dir.iterdir()]
            if entries:
                entries.sort(key=lambda p: p.stat().st_mtime, reverse=True)
                src_path = entries[0]
    # fallback to existing external/notion
    if not src_path:
        src_path = (repo_root / "external" / "notion").resolve()

    # If src_path is a zip file, extract into a temporary dir for the duration of the run.
    tempdir_ctx = None
    if src_path.is_file() and src_path.suffix.lower() == ".zip":
        tempdir_ctx = tempfile.TemporaryDirectory()
        try:
            shutil.unpack_archive(str(src_path), tempdir_ctx.name)
            external = Path(tempdir_ctx.name)
        except Exception:
            tempdir_ctx.cleanup()
            raise
    else:
        external = src_path.resolve()
    out_root = (repo_root / "content").resolve()
    docs = (repo_root / "docs").resolve()
    if not external.is_dir():
        raise SystemExit(f"missing {external}")

    if clean and out_root.is_dir():
        for child in out_root.glob("*.md"):
            child.unlink()

    out_root.mkdir(parents=True, exist_ok=True)
    docs.mkdir(parents=True, exist_ok=True)

    md_files = [p for p in external.rglob("*.md") if p.is_file()]
    # prepare repo-relative source paths for mapping/link resolution
    if external.resolve().is_relative_to(repo_root):
        source_label = str(external.resolve().relative_to(repo_root).as_posix())
    else:
        # try to synthesize a source label (exports/<name> or external/notion)
        if src_path and src_path.parent.name == "exports":
            source_label = f"exports/{src_path.name}"
        else:
            source_label = "external/notion"

    source_relpaths = [Path(_make_relposix(p, repo_root, external, source_label)) for p in md_files]
    by_resolved, id_to = build_target_to_output(source_relpaths, repo_root)

    # expand id_to: same basename mapping
    manifest: dict = {"version": 1, "files": {}}
    all_outputs: list[tuple[Path, str, str, str | None]] = []  # out_path, text, source_relposix, type

    for abs_md in sorted(md_files, key=lambda p: str(p)):
        relposix = _make_relposix(abs_md, repo_root, external, source_label)
        out_name, content, mentry = process_markdown_file(abs_md, repo_root, relposix)
        out_p = out_root / out_name
        mentry["output"] = f"content/{out_name}"
        manifest["files"][out_name] = mentry
        all_outputs.append((out_p, content, relposix, "page"))
        (out_root / out_name).parent.mkdir(parents=True, exist_ok=True)

    # write initial content then link pass
    for out_p, text, __, _ in all_outputs:
        out_p.write_text(text, encoding="utf-8", newline="\n")

    # CSV → index: plan filenames and map .csv source paths to index output (for .csv link targets)
    csv_files = sorted([p for p in external.rglob("*.csv") if p.is_file()], key=lambda p: str(p))
    seen_index_names: set[str] = set()
    csv_to_output: dict[str, str] = {}
    index_plans: list[
        tuple[Path, str, object | None, str, str]
    ] = []  # csvp, out_idx, parsed, vkey, relp
    for csvp in csv_files:
        relposix = _make_relposix(csvp, repo_root, external, source_label)
        out_idx, parsed, vkey, relposix = _plan_index_filename(
            csvp, repo_root, seen_index_names, relposix
        )
        abs_csv = str(csvp.resolve())
        csv_to_output[abs_csv] = out_idx
        index_plans.append((csvp, out_idx, parsed, vkey, relposix))

    for csvp, out_idx, parsed, vkey, relp in index_plans:
        ttitle = f"Index: {csvp.stem} ({vkey})"
        headers, rows = indexes.read_csv_rows(csvp)
        if not headers:
            continue
        fmd: dict = {
            "title": ttitle,
            "type": "notion-index",
            "view": vkey,
            "source_export": relp,
        }
        if parsed:
            fmd["notion_database"] = parsed[1]
        table = gfm_table(headers, rows)
        content = (
            yamlfmt.format_front_matter(fmd) + f"# {ttitle}\n\n" + table
        )
        ip = out_root / out_idx
        ip.write_text(content, encoding="utf-8", newline="\n")
        manifest["files"][out_idx] = {
            "type": "notion-index",
            "source_export": relp,
            "output": f"content/{out_idx}",
        }
        if parsed:
            manifest["files"][out_idx]["notion_database"] = parsed[1]

    # second pass: rewrite links
    def pass_rewrite(path: Path, source_relp: str) -> list[str]:
        t = path.read_text(encoding="utf-8", errors="replace")
        n, errs = rewrite_all_links(
            t, source_relp, repo_root, by_resolved, id_to, csv_to_output
        )
        path.write_text(n, encoding="utf-8", newline="\n")
        return errs

    all_err: list[str] = []
    for p in out_root.glob("*.md"):
        m = manifest["files"].get(p.name, {})
        src_exp = m.get("source_export")
        if not src_exp:
            continue
        all_err.extend(pass_rewrite(p, src_exp))

    (docs / "notion-link-report.txt").write_text(
        "\n".join(all_err) if all_err else "ok\n", encoding="utf-8", newline="\n"
    )
    (docs / "notion-import-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n"
    )

    # link check
    lc = _link_check(out_root)
    (docs / "notion-link-check.txt").write_text(
        "\n".join(lc) if lc else "ok\n", encoding="utf-8", newline="\n"
    )
    if lc:
        print("link_check issues:", len(lc))
        for x in lc[:20]:
            print(" ", x)

    # clean up temp dir if used
    if tempdir_ctx:
        tempdir_ctx.cleanup()


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Notion export → flat content/ markdown"
    )
    ap.add_argument(
        "--repo",
        type=Path,
        default=REPO,
        help="Repository root (default: marloth-story)",
    )
    ap.add_argument(
        "--source",
        type=Path,
        help="Optional: path to a Notion export directory or zip (overrides exports/)",
    )
    ap.add_argument(
        "--clean",
        action="store_true",
        help="Delete all content/*.md before import",
    )
    args = ap.parse_args()
    run(args.repo.resolve(), clean=args.clean, source=(args.source.resolve() if args.source else None))
    print("done. See content/ and docs/notion-*.md / manifest json")


if __name__ == "__main__":
    main()

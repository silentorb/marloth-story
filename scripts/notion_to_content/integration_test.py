"""Simple integration test for exports selection.

Creates a temporary export under ./exports/, runs the pipeline, and verifies that
`content/` has at least one generated markdown file. Intended for quick local
sanity checks.
"""
from __future__ import annotations

import shutil
import time
from pathlib import Path

from . import pipeline

REPO = Path(__file__).resolve().parent.parent.parent
EXPORTS = REPO / "exports"
TEST_DIR = EXPORTS / f"test-export-{int(time.time())}"
TEST_MD_NAME = "Test Page 0123456789abcdef0123456789abcdef.md"


def main() -> None:
    TEST_DIR.mkdir(parents=True, exist_ok=True)
    md_path = TEST_DIR / TEST_MD_NAME
    md_path.write_text("# Test Page\n\nThis is a test export.\n", encoding="utf-8")
    try:
        # Run pipeline preferring exports (default behaviour)
        pipeline.run(REPO, clean=True)
        # check for outputs
        content_dir = REPO / "content"
        out_files = list(content_dir.glob("*.md"))
        if out_files:
            print("OK: pipeline produced", len(out_files), "files. Example:")
            print(out_files[0].name)
        else:
            print("FAIL: no output files produced in content/")
    finally:
        # cleanup test export directory
        try:
            shutil.rmtree(TEST_DIR)
        except Exception:
            pass


if __name__ == "__main__":
    main()

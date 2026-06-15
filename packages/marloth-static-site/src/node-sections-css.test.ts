import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const css = readFileSync(join(import.meta.dir, "lib/node-sections.css"), "utf8");

describe("node-sections metadata collapse CSS", () => {
  test("hides metadata body when panel is not expanded", () => {
    expect(css).toMatch(
      /\.marloth-record-metadata-panel:not\(\.is-expanded\) \.marloth-record-metadata-body[\s\S]*display:\s*none/,
    );
  });

  test("shows metadata body as grid when panel is expanded", () => {
    expect(css).toMatch(
      /\.marloth-record-metadata-panel\.is-expanded \.marloth-record-metadata-body[\s\S]*display:\s*grid/,
    );
  });

  test("does not set unconditional display on metadata body", () => {
    expect(css).not.toMatch(/^\.marloth-record-metadata-body\s*\{/m);
  });
});

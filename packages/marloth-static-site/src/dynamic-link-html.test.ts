import { describe, expect, test } from "bun:test";
import { decorateDynamicLinkHtml } from "./lib/dynamic-link-html";

const TARGET = "aabbccdd112233445566778899aabbcc";

describe("decorateDynamicLinkHtml", () => {
  test("prefixes icon on dynamic node links only", () => {
    const html = `<p>See <a href="/nodes/${TARGET}/">Target</a> and <a href="/nodes/other/">Other</a>.</p>`;
    const out = decorateDynamicLinkHtml(html, new Set([TARGET]));
    expect(out).toContain("marloth-dynamic-node-link-wrap");
    expect(out).toContain("marloth-node-link-icon");
    expect(out).toContain(`href="/nodes/${TARGET}/"`);
    expect(out).not.toContain('href="/nodes/other/" class="marloth-dynamic-node-link"');
  });
});

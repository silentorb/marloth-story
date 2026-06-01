import { describe, expect, test } from "bun:test";
import { defaultValueCtx, Editor, rootCtx } from "@milkdown/core";
import { editorViewCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { TextSelection } from "@milkdown/prose/state";
import { DEFAULT_CALLOUT_PREFIX, hasLeadingCalloutEmoji } from "marloth-db/callout";
import { insertCalloutBlock } from "./callout-block";

describe("callout block insertion", () => {
  test("insertCalloutBlock creates blockquote with default emoji prefix", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, "Hello");
      })
      .use(commonmark)
      .create();

    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
      insertCalloutBlock(ctx);
    });

    const blockquote = root.querySelector("blockquote");
    expect(blockquote).toBeTruthy();
    const text = blockquote?.textContent ?? "";
    expect(hasLeadingCalloutEmoji(text)).toBe(true);
    expect(text.startsWith(DEFAULT_CALLOUT_PREFIX.trim())).toBe(true);

    await editor.destroy();
  });
});

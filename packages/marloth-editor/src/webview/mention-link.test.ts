import { describe, expect, test } from "bun:test";
import { defaultValueCtx, Editor, rootCtx } from "@milkdown/core";
import { editorViewCtx } from "@milkdown/kit/core";
import { replaceRange } from "@milkdown/kit/utils";
import { commonmark } from "@milkdown/preset-commonmark";
import { TextSelection } from "@milkdown/prose/state";
import { formatMarlothLink, marlothHref } from "../shared/types";
import { activeMentionRangeAtSelection } from "./mention-range";

const TARGET_ID = "e5cc80dc61ed4c629951cdf472b20b7a";

describe("@ mention link insertion", () => {
  test("replaceRange renders marloth href as a clickable anchor", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, "See @co here");
      })
      .use(commonmark)
      .create();

    const link = formatMarlothLink("Cozy horror", TARGET_ID);
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      let cursor = 1;
      view.state.doc.descendants((node, pos) => {
        if (!node.isText || cursor !== 1) return;
        const idx = node.text?.indexOf("@co") ?? -1;
        if (idx >= 0) cursor = pos + 1 + idx + 3;
      });
      const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, cursor));
      view.dispatch(tr);
      const range = activeMentionRangeAtSelection(view.state);
      expect(range).not.toBeNull();
      replaceRange(link, { from: range!.replaceFrom, to: range!.replaceTo })(ctx);
    });

    const anchor = root.querySelector(`a[href="${marlothHref(TARGET_ID)}"]`);
    expect(anchor).toBeTruthy();
    expect(anchor?.textContent).toBe("Cozy horror");
    expect(root.textContent).not.toContain("@co");

    await editor.destroy();
  });

  test("stored mention range inserts after selection moves away", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, "See @co here");
      })
      .use(commonmark)
      .create();

    const link = formatMarlothLink("Cozy horror", TARGET_ID);
    let storedFrom = 0;
    let storedTo = 0;
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      let cursor = 1;
      view.state.doc.descendants((node, pos) => {
        if (!node.isText || cursor !== 1) return;
        const idx = node.text?.indexOf("@co") ?? -1;
        if (idx >= 0) cursor = pos + 1 + idx + 3;
      });
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, cursor)),
      );
      const range = activeMentionRangeAtSelection(view.state);
      expect(range).not.toBeNull();
      storedFrom = range!.replaceFrom;
      storedTo = range!.replaceTo;
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)),
      );
      expect(activeMentionRangeAtSelection(view.state)).toBeNull();
      replaceRange(link, { from: storedFrom, to: storedTo })(ctx);
    });

    const anchor = root.querySelector(`a[href="${marlothHref(TARGET_ID)}"]`);
    expect(anchor).toBeTruthy();
    expect(root.textContent).not.toContain("@co");

    await editor.destroy();
  });
});

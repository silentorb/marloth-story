import { describe, expect, test } from "bun:test";
import { defaultValueCtx, Editor, rootCtx } from "@milkdown/core";
import { editorViewCtx } from "@milkdown/kit/core";
import { replaceRange } from "@milkdown/kit/utils";
import { commonmark } from "@milkdown/preset-commonmark";
import type { EditorView } from "@milkdown/prose/view";
import { TextSelection } from "@milkdown/prose/state";
import { formatMarlothLink, marlothHref } from "../shared/types";
import { installLinkCursor } from "./link-cursor";
import {
  activeMentionRangeAtSelection,
  resolveMentionInsertRange,
} from "./mention-range";

const TARGET_ID = "e5cc80dc61ed4c629951cdf472b20b7a";

async function setupEditor(body: string): Promise<{ editor: Editor; root: HTMLDivElement }> {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, body);
    })
    .use(commonmark)
    .create();
  return { editor, root };
}

async function cursorAfterMention(body: string, mention: string): Promise<number> {
  const { editor } = await setupEditor(body);
  let cursor = -1;
  await editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    view.state.doc.descendants((node, pos) => {
      if (cursor >= 0 || !node.isText || !node.text?.includes(mention)) return;
      const idx = node.text.indexOf(mention);
      cursor = pos + idx + mention.length;
    });
    expect(cursor).toBeGreaterThan(0);
  });
  await editor.destroy();
  return cursor;
}

function trailingTextPos(view: EditorView): number {
  let pos = 1;
  view.state.doc.descendants((node, nodePos) => {
    if (node.isText) pos = nodePos + node.nodeSize - 1;
  });
  // Step past the last inline character so non-inclusive link marks are cleared.
  return pos + 1;
}

describe("link cursor", () => {
  test("typing after a trailing link does not extend the mark", async () => {
    const { editor, root } = await setupEditor(
      `See ${formatMarlothLink("Cozy horror", TARGET_ID)}`,
    );

    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      installLinkCursor(view);
      const pos = trailingTextPos(view);
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)),
      );
      const linkType = view.state.schema.marks.link!;
      expect(linkType.isInSet(view.state.selection.$from.marks())).toBeUndefined();
      view.dispatch(view.state.tr.insertText(" next"));
    });

    const anchor = root.querySelector(`a[href="${marlothHref(TARGET_ID)}"]`);
    expect(anchor?.textContent).toBe("Cozy horror");
    expect(root.textContent).toBe("See Cozy horror next");

    await editor.destroy();
  });
});

describe("@ mention link insertion", () => {
  test("replaceRange renders marloth href as a clickable anchor", async () => {
    const cursor = await cursorAfterMention("See @co here", "@co");
    const { editor, root } = await setupEditor("See @co here");
    const link = formatMarlothLink("Cozy horror", TARGET_ID);
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      installLinkCursor(view);
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, cursor)),
      );
      const range = activeMentionRangeAtSelection(view.state);
      expect(range).not.toBeNull();
      replaceRange(link, { from: range!.replaceFrom, to: range!.replaceTo })(ctx);
    });

    const anchor = root.querySelector(`a[href="${marlothHref(TARGET_ID)}"]`);
    expect(anchor).toBeTruthy();
    expect(anchor?.textContent).toBe("Cozy horror");
    expect(root.textContent).not.toContain("@co");
    expect(root.textContent).toBe("See Cozy horror here");

    await editor.destroy();
  });

  test("stored mention range inserts after selection moves away", async () => {
    const cursor = await cursorAfterMention("See @co here", "@co");
    const { editor, root } = await setupEditor("See @co here");
    const link = formatMarlothLink("Cozy horror", TARGET_ID);
    let storedFrom = 0;
    let storedTo = 0;
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      installLinkCursor(view);
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
    expect(root.textContent).toBe("See Cozy horror here");

    await editor.destroy();
  });

  test("resolveMentionInsertRange preserves surrounding spaces", async () => {
    const cursor = await cursorAfterMention("See @co here", "@co");
    const { editor, root } = await setupEditor("See @co here");
    await editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      installLinkCursor(view);
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, cursor)),
      );
      const live = activeMentionRangeAtSelection(view.state);
      expect(live).not.toBeNull();
      const resolved = resolveMentionInsertRange(view.state, live);
      expect(resolved?.replaceFrom).toBe(5);
      expect(resolved?.replaceTo).toBe(8);
      replaceRange(formatMarlothLink("Cozy horror", TARGET_ID), {
        from: resolved!.replaceFrom,
        to: resolved!.replaceTo,
      })(ctx);
    });

    expect(root.textContent).toBe("See Cozy horror here");
    await editor.destroy();
  });
});

import { Plugin } from "@milkdown/prose/state";
import type { EditorView } from "@milkdown/prose/view";
import { isCalloutBlockquoteNode } from "./callout-decoration";

function selectionInCallout(view: EditorView): boolean {
  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name !== "blockquote") continue;
    const pos = $from.before(depth);
    const dom = view.nodeDOM(pos);
    if (dom instanceof HTMLElement && dom.classList.contains("marloth-callout")) {
      return true;
    }
    return isCalloutBlockquoteNode(node);
  }
  return false;
}

/** Use the native caret inside callouts; virtual cursor breaks with hanging-indent layout. */
export function createCalloutCursorPlugin(): Plugin {
  return new Plugin({
    view(view: EditorView) {
      const sync = () => {
        view.dom.classList.toggle("marloth-callout-editing", selectionInCallout(view));
      };
      sync();
      return {
        update(nextView) {
          sync();
        },
      };
    },
  });
}

export function installCalloutCursor(view: EditorView): void {
  const plugin = createCalloutCursorPlugin();
  view.updateState(view.state.reconfigure({ plugins: [...view.state.plugins, plugin] }));
}

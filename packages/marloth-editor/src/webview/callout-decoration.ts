import { Plugin } from "@milkdown/prose/state";
import type { EditorView } from "@milkdown/prose/view";

const LEADING_CALLOUT_EMOJI =
  /^[\p{Extended_Pictographic}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{FE0F}\u{200D}]+(?:\s+)?/u;

function stripEmojis(text: string): string {
  return text
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{1F1E0}-\u{1F1FF}\u{200D}\u{FE0F}\u{1F3FB}-\u{1F3FF}\u{E000}-\u{F8FF}]+/gu,
      "",
    )
    .replace(/\u200d/g, "")
    .replace(/\ufe0f/g, "")
    .trim();
}

export function isEmojiOnlyLine(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && stripEmojis(trimmed) === "";
}

export function hasLeadingCalloutEmoji(text: string): boolean {
  return LEADING_CALLOUT_EMOJI.test(text.trimStart());
}

export function isCalloutBlockquote(blockquote: HTMLElement): boolean {
  const firstParagraph = blockquote.querySelector(":scope > p");
  if (!firstParagraph) return false;
  const text = firstParagraph.textContent ?? "";
  const firstLine = text.split("\n")[0] ?? "";
  return hasLeadingCalloutEmoji(firstLine);
}

export function decorateCallouts(root: ParentNode): void {
  root.querySelectorAll("blockquote").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.classList.toggle("marloth-callout", isCalloutBlockquote(node));
  });
}

export function createCalloutDecorationPlugin(): Plugin {
  return new Plugin({
    view(view: EditorView) {
      const apply = () => decorateCallouts(view.dom);
      apply();
      return {
        update(nextView, prevState) {
          if (nextView.state.doc !== prevState.doc) apply();
        },
      };
    },
  });
}

export function installCalloutDecoration(view: EditorView): void {
  const plugin = createCalloutDecorationPlugin();
  view.updateState(view.state.reconfigure({ plugins: [...view.state.plugins, plugin] }));
}

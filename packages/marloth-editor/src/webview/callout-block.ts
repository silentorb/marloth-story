import type { Ctx } from "@milkdown/kit/ctx";
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core";
import {
  blockquoteSchema,
  clearTextInCurrentBlockCommand,
  wrapInBlockTypeCommand,
} from "@milkdown/kit/preset/commonmark";
import { replaceRange } from "@milkdown/kit/utils";
import type { BlockEditFeatureConfig } from "@milkdown/crepe/feature/block-edit";
import { DEFAULT_CALLOUT_PREFIX } from "marloth-db/callout";

export const calloutIcon = `
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 1 7 7c0 2.2-1 4.2-2.6 5.5L16 17H8l-.4-2.5A7 7 0 0 1 5 9a7 7 0 0 1 7-7z" />
  </svg>
`;

/**
 * Insert a callout block. Stored as markdown blockquote for compatibility;
 * the editor renders callouts as tinted panels (see `.marloth-callout` CSS).
 */
export function insertCalloutBlock(ctx: Ctx): void {
  const commands = ctx.get(commandsCtx);
  const blockquote = blockquoteSchema.type(ctx);

  commands.call(clearTextInCurrentBlockCommand.key);
  commands.call(wrapInBlockTypeCommand.key, { nodeType: blockquote });

  const view = ctx.get(editorViewCtx);
  const { from, to } = view.state.selection;
  replaceRange(DEFAULT_CALLOUT_PREFIX, { from, to })(ctx);
}

export const buildCalloutSlashMenu: NonNullable<BlockEditFeatureConfig["buildMenu"]> = (
  builder,
) => {
  builder.getGroup("text").addItem("callout", {
    label: "Callout",
    icon: calloutIcon,
    onRun: (ctx) => insertCalloutBlock(ctx),
  });
};

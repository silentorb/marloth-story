import * as vscode from "vscode";
import {
  MarlothEditorProvider,
  openCreate,
  openHome,
  openNode,
  openSearch,
  registerEditorProvider,
} from "./provider";
import { stopApiServer } from "./api-bridge";
import { nodeIdFromUri } from "../shared/types";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new MarlothEditorProvider(context);
  registerEditorProvider(provider);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider("marloth.editor", provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: true,
    }),
    vscode.commands.registerCommand("marloth.openHome", () => openHome(context)),
    vscode.commands.registerCommand("marloth.createNode", () => openCreate(context)),
    vscode.commands.registerCommand("marloth.search", () => openSearch(context)),
    vscode.commands.registerCommand("marloth.openNode", (nodeId?: string) => {
      if (typeof nodeId === "string" && nodeId) {
        return openNode(nodeId, { preview: false });
      }
      return vscode.window
        .showInputBox({ prompt: "Node id (32-char hex)" })
        .then((id) => (id ? openNode(id, { preview: false }) : undefined));
    }),
    vscode.commands.registerCommand("marloth.openNodeFromUri", (uri: vscode.Uri) => {
      const id = nodeIdFromUri(uri.toString());
      if (id) return openNode(id, { preview: false });
    }),
    { dispose: () => stopApiServer() },
  );
}

export function deactivate(): void {}

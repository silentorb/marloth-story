import * as vscode from "vscode";
import { MarlothEditorProvider, openHome, openRecord } from "./provider";
import { stopApiServer } from "./api-bridge";
import { recordIdFromUri } from "../shared/types";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new MarlothEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider("marloth.editor", provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: true,
    }),
    vscode.commands.registerCommand("marloth.openHome", () => openHome(context)),
    vscode.commands.registerCommand("marloth.openRecord", (recordId?: string) => {
      if (typeof recordId === "string" && recordId) {
        return openRecord(recordId, { preview: false });
      }
      return vscode.window
        .showInputBox({ prompt: "Record id (32-char hex)" })
        .then((id) => (id ? openRecord(id, { preview: false }) : undefined));
    }),
    vscode.commands.registerCommand("marloth.openRecordFromUri", (uri: vscode.Uri) => {
      const id = recordIdFromUri(uri.toString());
      if (id) return openRecord(id, { preview: false });
    }),
    { dispose: () => stopApiServer() },
  );
}

export function deactivate(): void {}

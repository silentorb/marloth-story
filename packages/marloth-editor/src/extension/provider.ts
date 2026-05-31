import * as vscode from "vscode";
import { existsSync } from "node:fs";
import { ensureApiServer, resolveApiBaseUrl } from "./api-bridge";
import { nodeIdFromUri, nodeUri } from "../shared/types";
import type { EditorApiClient } from "../shared/http-client";

async function isDevWebviewReachable(baseUrl: string): Promise<boolean> {
  const url = baseUrl.replace(/\/$/, "");
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(800) });
    return res.ok;
  } catch {
    return false;
  }
}

export class MarlothDocument implements vscode.CustomDocument {
  static async create(nodeId: string): Promise<MarlothDocument> {
    return new MarlothDocument(nodeId);
  }

  private constructor(readonly nodeId: string) {}

  dispose(): void {
    /* no resources */
  }
}

export class MarlothEditorProvider implements vscode.CustomEditorProvider<MarlothDocument> {
  private api: EditorApiClient | null = null;
  private readonly devMode: boolean;
  private readonly devWebviewUrl: string;
  private readonly panels = new Map<string, vscode.WebviewPanel>();
  private pendingCreateView = false;
  private pendingSearchOpen = false;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.devMode = context.extensionMode === vscode.ExtensionMode.Development;
    this.devWebviewUrl = process.env.MARLOTH_EDITOR_WEBVIEW_URL ?? "http://127.0.0.1:5173";
  }

  private async client(): Promise<EditorApiClient> {
    if (!this.api) {
      this.api = await ensureApiServer(this.context.extensionPath);
    }
    return this.api;
  }

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken,
  ): Promise<MarlothDocument> {
    const nodeId = nodeIdFromUri(uri.toString());
    if (!nodeId) {
      throw new Error(`Invalid Marloth URI: ${uri.toString()}`);
    }
    return MarlothDocument.create(nodeId);
  }

  async resolveCustomEditor(
    document: MarlothDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    await this.client();

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist-webview"),
      ],
    };

    webviewPanel.webview.html = await this.buildHtml(webviewPanel.webview);
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message, webviewPanel);
    });

    this.panels.set(document.nodeId, webviewPanel);
    webviewPanel.onDidDispose(() => {
      this.panels.delete(document.nodeId);
    });

    if (this.pendingCreateView) {
      this.pendingCreateView = false;
      webviewPanel.webview.postMessage({ type: "navigate", view: "create-node" });
      webviewPanel.title = "New page";
    } else if (this.pendingSearchOpen) {
      this.pendingSearchOpen = false;
      webviewPanel.webview.postMessage({ type: "openSearch" });
    } else {
      webviewPanel.webview.postMessage({ type: "init", nodeId: document.nodeId });
    }
  }

  showSearch(): boolean {
    for (const panel of this.panels.values()) {
      panel.webview.postMessage({ type: "openSearch" });
      return true;
    }
    return false;
  }

  markPendingSearchOpen(): void {
    this.pendingSearchOpen = true;
  }

  showCreateView(homeId: string): void {
    const panel = this.panels.get(homeId);
    if (panel) {
      panel.webview.postMessage({ type: "navigate", view: "create-node" });
      panel.title = "New page";
      return;
    }
    this.pendingCreateView = true;
  }

  private async buildHtml(webview: vscode.Webview): Promise<string> {
    const bundledReady = existsSync(
      vscode.Uri.joinPath(this.context.extensionUri, "dist-webview", "assets", "index.js").fsPath,
    );
    const useVite = this.devMode && (await isDevWebviewReachable(this.devWebviewUrl));
    if (useVite) {
      return this.getViteHtml(webview);
    }
    if (!bundledReady) {
      throw new Error(
        "Marloth webview is not built. Run: bun run editor:build (or bun run editor:dev for HMR).",
      );
    }
    return this.getBundledHtml(webview);
  }

  private getViteHtml(webview: vscode.Webview): string {
    const csp = [
      "default-src 'none'",
      `script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval' ${this.devWebviewUrl}`,
      `style-src ${webview.cspSource} 'unsafe-inline' ${this.devWebviewUrl}`,
      `font-src ${webview.cspSource} ${this.devWebviewUrl}`,
      `img-src ${webview.cspSource} data: ${this.devWebviewUrl}`,
      `connect-src ${webview.cspSource} ws://127.0.0.1:5173 ${this.devWebviewUrl} ${resolveApiBaseUrl()}`,
    ].join("; ");
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <title>Marloth Editor (dev)</title>
</head>
<body style="background: #191919; color: #ebebea">
  <div id="root"></div>
  <script type="module" src="${this.devWebviewUrl}/@vite/client"></script>
  <script type="module" src="${this.devWebviewUrl}/src/webview/main.tsx"></script>
</body>
</html>`;
  }

  private getBundledHtml(webview: vscode.Webview): string {
    const assetsDir = vscode.Uri.joinPath(this.context.extensionUri, "dist-webview", "assets");
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, "index.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, "index.css"));
    const csp = [
      "default-src 'none'",
      `script-src ${webview.cspSource}`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `img-src ${webview.cspSource} data:`,
      `connect-src ${webview.cspSource} ${resolveApiBaseUrl()}`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <link rel="stylesheet" href="${styleUri}">
  <title>Marloth Editor</title>
</head>
<body style="background: #191919; color: #ebebea">
  <div id="root"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private async handleMessage(
    message: { type?: string; nodeId?: string; view?: string; openInNewTab?: boolean },
    panel: vscode.WebviewPanel,
  ): Promise<void> {
    if (message.type !== "navigate") return;

    if (message.view === "create-node") {
      panel.webview.postMessage({ type: "navigate", view: "create-node" });
      panel.title = "New page";
      return;
    }

    const targetId = message.nodeId;
    if (!targetId) return;

    if (message.openInNewTab) {
      await vscode.commands.executeCommand("marloth.openNode", targetId, { preview: false });
      return;
    }

    panel.webview.postMessage({ type: "navigate", nodeId: targetId });
    try {
      const api = await this.client();
      const record = await api.getNode(targetId);
      panel.title = record.title;
    } catch {
      panel.title = targetId;
    }
  }
}

export async function openNode(nodeId: string, options?: { preview?: boolean }): Promise<void> {
  const uri = vscode.Uri.parse(nodeUri(nodeId));
  await vscode.commands.executeCommand(
    "vscode.openWith",
    uri,
    "marloth.editor",
    { preview: options?.preview ?? false },
  );
}

export async function openHome(context: vscode.ExtensionContext): Promise<void> {
  const api = await ensureApiServer(context.extensionPath);
  const homeId = await api.getHomeId();
  await openNode(homeId, { preview: false });
}

let editorProvider: MarlothEditorProvider | null = null;

export function registerEditorProvider(provider: MarlothEditorProvider): void {
  editorProvider = provider;
}

export async function openCreate(context: vscode.ExtensionContext): Promise<void> {
  const api = await ensureApiServer(context.extensionPath);
  const homeId = await api.getHomeId();
  await openNode(homeId, { preview: false });
  editorProvider?.showCreateView(homeId);
}

export async function openSearch(context: vscode.ExtensionContext): Promise<void> {
  if (editorProvider?.showSearch()) return;
  const api = await ensureApiServer(context.extensionPath);
  const homeId = await api.getHomeId();
  editorProvider?.markPendingSearchOpen();
  await openNode(homeId, { preview: false });
}

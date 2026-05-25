import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHttpEditorClient, waitForApi, type EditorApiClient } from "../shared/http-client";

const DEFAULT_PORT = 3847;

let serverProcess: ChildProcess | null = null;

export function resolveApiBaseUrl(): string {
  const port = process.env.MARLOTH_EDITOR_API_PORT ?? String(DEFAULT_PORT);
  return `http://127.0.0.1:${port}`;
}

function resolveRepoRoot(extensionRoot: string): string {
  const candidates = [resolve(extensionRoot, "../.."), process.cwd()];
  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, "data/marloth.sqlite"))) return candidate;
  }
  return resolve(extensionRoot, "../..");
}

export async function ensureApiServer(extensionRoot: string): Promise<EditorApiClient> {
  const baseUrl = resolveApiBaseUrl();
  if (await waitForApi(baseUrl, 2)) {
    return createHttpEditorClient(baseUrl);
  }

  if (!serverProcess) {
    const serverEntry = resolve(extensionRoot, "src/api/server.ts");
    const repoRoot = resolveRepoRoot(extensionRoot);
    serverProcess = spawn("bun", [serverEntry], {
      cwd: repoRoot,
      env: {
        ...process.env,
        MARLOTH_EDITOR_API_PORT: process.env.MARLOTH_EDITOR_API_PORT ?? String(DEFAULT_PORT),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    serverProcess.on("exit", () => {
      serverProcess = null;
    });
  }

  const ready = await waitForApi(baseUrl);
  if (!ready) {
    throw new Error(`Marloth editor API did not start at ${baseUrl}`);
  }
  return createHttpEditorClient(baseUrl);
}

export function stopApiServer(): void {
  serverProcess?.kill();
  serverProcess = null;
}

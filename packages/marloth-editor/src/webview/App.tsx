import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarlothEditor } from "./components/MarlothEditor";
import { createEditorApi } from "./api/client";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function recordFromLocation(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("record");
}

export function App() {
  const api = useMemo(() => createEditorApi(), []);
  const [record, setRecord] = useState<Awaited<ReturnType<typeof api.getRecord>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const pendingBody = useRef<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  const loadRecord = useCallback(
    async (recordId: string) => {
      setError(null);
      try {
        const detail = await api.getRecord(recordId);
        setRecord(detail);
        pendingBody.current = detail.body;
        setSaveState("idle");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api],
  );

  const bootstrap = useCallback(async () => {
    if (api.host === "vscode") return;
    const fromUrl = recordFromLocation();
    if (fromUrl) {
      await loadRecord(fromUrl);
      return;
    }
    const homeId = await api.getHomeId();
    await loadRecord(homeId);
  }, [api, loadRecord]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (api.host !== "vscode") return;
    const onMessage = (event: MessageEvent) => {
      const msg = event.data as { type?: string; recordId?: string; error?: string };
      if (msg.type === "init" || msg.type === "navigate") {
        if (msg.recordId) void loadRecord(msg.recordId);
      }
      if (msg.type === "error") {
        setError(msg.error ?? "Unknown error");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [api.host, loadRecord]);

  useEffect(() => {
    if (api.host !== "standalone") return;
    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ recordId: string }>).detail;
      void loadRecord(detail.recordId);
    };
    window.addEventListener("marloth:navigate", onNavigate);
    return () => window.removeEventListener("marloth:navigate", onNavigate);
  }, [api.host, loadRecord]);

  const scheduleSave = useCallback(
    (body: string) => {
      if (!record) return;
      pendingBody.current = body;
      setSaveState("dirty");
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void (async () => {
          if (!record || pendingBody.current === null) return;
          setSaveState("saving");
          try {
            await api.saveBody(record.id, pendingBody.current);
            setSaveState("saved");
          } catch {
            setSaveState("error");
          }
        })();
      }, 800);
    },
    [api, record],
  );

  const goHome = useCallback(async () => {
    const homeId = await api.getHomeId();
    api.navigate(homeId, false);
    if (api.host === "standalone") await loadRecord(homeId);
  }, [api, loadRecord]);

  if (error) {
    return <div className="marloth-error">{error}</div>;
  }

  if (!record) {
    return <div className="marloth-loading">Loading…</div>;
  }

  return (
    <>
      <div className="marloth-app-bar">
        <button type="button" onClick={() => void goHome()}>
          Home
        </button>
        {record.path ? <span className="marloth-save-status">{record.path}</span> : null}
        <span className={`marloth-save-status is-${saveState}`}>
          {saveState === "dirty"
            ? "Unsaved changes"
            : saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved"
                : saveState === "error"
                  ? "Save failed"
                  : ""}
        </span>
      </div>
      <MarlothEditor
        key={record.id}
        api={api}
        recordId={record.id}
        title={record.title}
        initialBody={record.body}
        onBodyChange={scheduleSave}
        onNavigate={(id, openInNewTab) => {
          if (api.host === "standalone" && !openInNewTab) void loadRecord(id);
        }}
      />
    </>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphView } from "./components/GraphView";
import { MarlothEditor } from "./components/MarlothEditor";
import { SidePanel } from "./components/SidePanel";
import { createEditorApi } from "./api/client";
import type { AppView } from "../shared/types";
import {
  readGraphShowNodeLabels,
  writeGraphShowNodeLabels,
} from "./graph-preferences";

export type { AppView };

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function recordFromLocation(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("record");
}

function viewFromLocation(): AppView {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  if (view === "overview") return "graph-overview";
  if (view === "explorer") return "graph-explorer";
  return "record";
}

function viewToQueryParam(view: AppView): string | null {
  if (view === "graph-overview") return "overview";
  if (view === "graph-explorer") return "explorer";
  return null;
}

export function App() {
  const api = useMemo(() => createEditorApi(), []);
  const [view, setView] = useState<AppView>(() =>
    api.host === "standalone" ? viewFromLocation() : "record",
  );
  const [record, setRecord] = useState<Awaited<ReturnType<typeof api.getRecord>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showGraphNodeLabels, setShowGraphNodeLabels] = useState(readGraphShowNodeLabels);
  const pendingBody = useRef<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  const syncStandaloneUrl = useCallback(
    (nextView: AppView, recordId?: string | null) => {
      if (api.host !== "standalone") return;
      const url = new URL(window.location.href);
      const viewParam = viewToQueryParam(nextView);
      if (viewParam) url.searchParams.set("view", viewParam);
      else url.searchParams.delete("view");
      if (recordId) url.searchParams.set("record", recordId);
      window.history.replaceState({}, "", url.toString());
    },
    [api.host],
  );

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
    const initialView = viewFromLocation();
    setView(initialView);
    if (initialView !== "record") return;

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
        if (msg.recordId) {
          setView("record");
          void loadRecord(msg.recordId);
        }
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
      setView("record");
      syncStandaloneUrl("record", detail.recordId);
      void loadRecord(detail.recordId);
    };
    window.addEventListener("marloth:navigate", onNavigate);
    return () => window.removeEventListener("marloth:navigate", onNavigate);
  }, [api.host, loadRecord, syncStandaloneUrl]);

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
    setView("record");
    syncStandaloneUrl("record", homeId);
    api.navigate(homeId, false);
    if (api.host === "standalone") await loadRecord(homeId);
  }, [api, loadRecord, syncStandaloneUrl]);

  const changeView = useCallback(
    (nextView: AppView) => {
      setView(nextView);
      syncStandaloneUrl(nextView, record?.id ?? recordFromLocation());
    },
    [record?.id, syncStandaloneUrl],
  );

  const openRecordFromGraph = useCallback(
    (recordId: string) => {
      setView("record");
      syncStandaloneUrl("record", recordId);
      api.navigate(recordId, false);
      if (api.host === "standalone") void loadRecord(recordId);
    },
    [api, loadRecord, syncStandaloneUrl],
  );

  const setShowGraphNodeLabelsPersisted = useCallback((value: boolean) => {
    setShowGraphNodeLabels(value);
    writeGraphShowNodeLabels(value);
  }, []);

  return (
    <div className="marloth-layout">
      <SidePanel activeView={view} onHome={() => void goHome()} onViewChange={changeView} />
      <div className="marloth-main">
        {view === "graph-overview" ? (
          <GraphView
            mode="overview"
            api={api}
            showNodeLabels={showGraphNodeLabels}
            onShowNodeLabelsChange={setShowGraphNodeLabelsPersisted}
            onOpenRecord={openRecordFromGraph}
          />
        ) : view === "graph-explorer" ? (
          <GraphView
            mode="explorer"
            api={api}
            showNodeLabels={showGraphNodeLabels}
            onShowNodeLabelsChange={setShowGraphNodeLabelsPersisted}
            onOpenRecord={openRecordFromGraph}
          />
        ) : error ? (
          <div className="marloth-error">{error}</div>
        ) : !record ? (
          <div className="marloth-loading">Loading…</div>
        ) : (
          <>
            <div className="marloth-app-bar">
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
        )}
      </div>
    </div>
  );
}

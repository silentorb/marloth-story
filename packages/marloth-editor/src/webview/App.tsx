import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphView } from "./components/GraphView";
import { RecordPageView } from "./components/RecordPageView";
import { SidePanel } from "./components/SidePanel";
import { createEditorApi } from "./api/client";
import { UserSettingsProvider } from "./hooks/useUserSettings";
import type { GetRecordOptions } from "../shared/http-client";
import type { AppView, OrderedAssociationViewDetail, RecordPageDetail } from "../shared/types";
import { standaloneRecordUrl } from "../shared/types";
import { navigateStandaloneRecord, standaloneViewUrl } from "./record-links";
import {
  readGraphShowNodeLabels,
  writeGraphShowNodeLabels,
} from "./graph-preferences";
import { syncDocumentTitle } from "./document-title";

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

function databaseViewFromLocation(): string | undefined {
  const params = new URLSearchParams(window.location.search);
  const dbView = params.get("dbView");
  return dbView ?? undefined;
}

function scopeFromLocation(): string | undefined {
  const params = new URLSearchParams(window.location.search);
  const scope = params.get("scope");
  return scope ?? undefined;
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
  const [record, setRecord] = useState<RecordPageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showGraphNodeLabels, setShowGraphNodeLabels] = useState(readGraphShowNodeLabels);
  const [homeId, setHomeId] = useState<string | null>(null);
  const pendingBody = useRef<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  const standaloneUrls = useMemo(() => {
    if (api.host !== "standalone" || !homeId) return undefined;
    return {
      home: standaloneRecordUrl(homeId),
      overview: standaloneViewUrl("graph-overview"),
      explorer: standaloneViewUrl("graph-explorer"),
    };
  }, [api.host, homeId]);

  const syncStandaloneUrl = useCallback(
    (nextView: AppView, recordId?: string | null, options?: GetRecordOptions) => {
      if (api.host !== "standalone") return;
      const url = new URL(window.location.href);
      const viewParam = viewToQueryParam(nextView);
      if (viewParam) url.searchParams.set("view", viewParam);
      else url.searchParams.delete("view");
      if (recordId) url.searchParams.set("record", recordId);
      if (options?.scope) url.searchParams.set("scope", options.scope);
      else url.searchParams.delete("scope");
      if (options?.view) url.searchParams.set("dbView", options.view);
      window.history.replaceState({}, "", url.toString());
    },
    [api.host],
  );

  const loadRecord = useCallback(
    async (recordId: string, options?: GetRecordOptions | string) => {
      setError(null);
      try {
        const normalized =
          typeof options === "string" ? { view: options } : (options ?? {});
        const detail = await api.getRecord(recordId, normalized);
        setRecord(detail);
        pendingBody.current = detail.body;
        setSaveState("idle");
        syncStandaloneUrl("record", recordId, normalized);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, syncStandaloneUrl],
  );

  const bootstrap = useCallback(async () => {
    if (api.host === "vscode") return;
    const home = await api.getHomeId();
    setHomeId(home);
    const initialView = viewFromLocation();
    setView(initialView);
    if (initialView !== "record") return;

    const fromUrl = recordFromLocation();
    if (fromUrl) {
      await loadRecord(fromUrl, {
        view: databaseViewFromLocation(),
        scope: scopeFromLocation(),
      });
      return;
    }
    await loadRecord(home);
  }, [api, loadRecord]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    syncDocumentTitle(view, record?.title);
  }, [view, record?.title]);

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
    const nextHomeId = homeId ?? (await api.getHomeId());
    if (api.host === "standalone") {
      navigateStandaloneRecord(nextHomeId);
      return;
    }
    setView("record");
    syncStandaloneUrl("record", nextHomeId);
    void loadRecord(nextHomeId);
  }, [api, homeId, loadRecord, syncStandaloneUrl]);

  const changeView = useCallback(
    (nextView: AppView) => {
      if (api.host === "standalone") {
        window.location.assign(
          standaloneViewUrl(nextView, record?.id ?? recordFromLocation()),
        );
        return;
      }
      setView(nextView);
      syncStandaloneUrl(nextView, record?.id ?? recordFromLocation());
    },
    [api.host, record?.id, syncStandaloneUrl],
  );

  const openRecordFromGraph = useCallback(
    (recordId: string) => {
      if (api.host === "standalone") {
        navigateStandaloneRecord(recordId);
        return;
      }
      setView("record");
      syncStandaloneUrl("record", recordId);
      void loadRecord(recordId);
    },
    [api.host, loadRecord, syncStandaloneUrl],
  );

  const openLinkedRecord = useCallback(
    (recordId: string, openInNewTab = false) => {
      if (openInNewTab) {
        api.navigate(recordId, true);
        return;
      }
      setView("record");
      syncStandaloneUrl("record", recordId);
      void loadRecord(recordId);
    },
    [api, loadRecord, syncStandaloneUrl],
  );

  const setShowGraphNodeLabelsPersisted = useCallback((value: boolean) => {
    setShowGraphNodeLabels(value);
    writeGraphShowNodeLabels(value);
  }, []);

  const updateOrderedAssociationView = useCallback((view: OrderedAssociationViewDetail) => {
    setRecord((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map((section) =>
          section.type === "ordered-association" ? { ...section, view } : section,
        ),
      };
    });
  }, []);

  return (
    <UserSettingsProvider api={api}>
      <div className="marloth-layout">
      <SidePanel
        activeView={view}
        onHome={() => void goHome()}
        onViewChange={changeView}
        standaloneUrls={standaloneUrls}
      />
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
          <RecordPageView
            api={api}
            record={record}
            saveState={saveState}
            onBodyChange={scheduleSave}
            onDatabaseViewChange={(dbView) => void loadRecord(record.id, { view: dbView, scope: scopeFromLocation() })}
            onScopeChange={(scopeId) => void loadRecord(record.id, { scope: scopeId })}
            onOrderedAssociationViewChange={updateOrderedAssociationView}
            onOpenRecord={openLinkedRecord}
          />
        )}
      </div>
      </div>
    </UserSettingsProvider>
  );
}

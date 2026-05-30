import { useCallback, useEffect, useRef, useState } from "react";
import { editorViewCtx } from "@milkdown/kit/core";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame-dark.css";
import type { EditorApi } from "../api/client";
import {
  formatMarlothLink,
  marlothHref,
} from "../../shared/types";
import type { NodeSummary } from "../../shared/types";
import { installCalloutDecoration } from "../callout-decoration";
import { resolveNodeLinkTarget } from "../node-links";
import { preprocessStandaloneMarkdown } from "../standalone-markdown";
import "./editor.css";

interface MentionState {
  query: string;
  top: number;
  left: number;
  activeIndex: number;
}

interface MarlothEditorProps {
  api: EditorApi;
  nodeId: string;
  initialBody: string;
  title?: string;
  hideTitle?: boolean;
  onEditorBaseline?: (body: string) => void;
  onBodyChange?: (body: string) => void;
  onNavigate?: (nodeId: string, openInNewTab?: boolean) => void;
}

export function MarlothEditor({
  api,
  nodeId,
  initialBody,
  title = "",
  hideTitle = true,
  onEditorBaseline,
  onBodyChange,
  onNavigate,
}: MarlothEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [results, setResults] = useState<NodeSummary[]>([]);
  const [initError, setInitError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(() => !initialBody.trim());
  const mentionRef = useRef<MentionState | null>(null);
  const resultsRef = useRef<NodeSummary[]>([]);
  mentionRef.current = mention;
  resultsRef.current = results;

  const closeMention = useCallback(() => {
    setMention(null);
    setResults([]);
  }, []);

  const insertMention = useCallback(
    (item: NodeSummary) => {
      const editor = crepeRef.current?.editor;
      if (!editor) return;
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const { state, dispatch } = view;
        const { from } = state.selection;
        const mentionState = mentionRef.current;
        if (!mentionState) return;
        const atPos = from - mentionState.query.length - 1;
        const link = formatMarlothLink(item.title, item.id);
        dispatch(state.tr.insertText(link, atPos, from));
      });
      closeMention();
    },
    [closeMention],
  );

  useEffect(() => {
    if (!mention) return;
    const handle = window.setTimeout(() => {
      void api.search(mention.query, 12).then(setResults).catch(() => setResults([]));
    }, 120);
    return () => window.clearTimeout(handle);
  }, [api, mention]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let destroyed = false;
    let editorReady = false;
    let baselineCaptured = false;
    setInitError(null);
    setIsEmpty(!initialBody.trim());
    root.replaceChildren();
    const editorDefault =
      api.host === "standalone"
        ? preprocessStandaloneMarkdown(initialBody, window.location.href)
        : initialBody;
    const crepe = new Crepe({
      root,
      defaultValue: editorDefault,
      features: {
        [Crepe.Feature.Toolbar]: true,
        [Crepe.Feature.LinkTooltip]: true,
        [Crepe.Feature.BlockEdit]: true,
        [Crepe.Feature.Placeholder]: true,
        [Crepe.Feature.Cursor]: true,
        [Crepe.Feature.ListItem]: true,
        [Crepe.Feature.Table]: true,
        [Crepe.Feature.CodeMirror]: true,
        [Crepe.Feature.Latex]: false,
        [Crepe.Feature.ImageBlock]: false,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          text: "Type '/' for blocks, '@' to link a record…",
        },
      },
    });

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
        if (markdown === prevMarkdown || destroyed || !editorReady) return;
        setIsEmpty(!markdown.trim());
        if (!baselineCaptured) {
          baselineCaptured = true;
          onEditorBaseline?.(markdown);
          return;
        }
        onBodyChange?.(markdown);
      });
    });

    crepeRef.current = crepe;

    void crepe.create().then(() => {
      if (destroyed) return;
      editorReady = true;
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const dom = view.dom;
        installCalloutDecoration(view);

        const onKeyDown = (event: KeyboardEvent) => {
          const state = mentionRef.current;
          if (!state) return;
          if (event.key === "Escape") {
            closeMention();
            event.preventDefault();
            return;
          }
          if (event.key === "ArrowDown") {
            const count = resultsRef.current.length;
            setMention((prev) =>
              prev ? { ...prev, activeIndex: Math.min(prev.activeIndex + 1, count - 1) } : prev,
            );
            event.preventDefault();
            return;
          }
          if (event.key === "ArrowUp") {
            setMention((prev) =>
              prev ? { ...prev, activeIndex: Math.max(prev.activeIndex - 1, 0) } : prev,
            );
            event.preventDefault();
            return;
          }
          if (event.key === "Enter") {
            const item = resultsRef.current[state.activeIndex];
            if (item) {
              insertMention(item);
              event.preventDefault();
            }
          }
        };

        const onInput = () => {
          const { state } = view;
          const { from } = state.selection;
          const textBefore = state.doc.textBetween(Math.max(0, from - 64), from, "\n", "\0");
          const atMatch = /(?:^|\s)@([\w\s\-'.]{0,48})$/.exec(textBefore);
          if (!atMatch) {
            if (mentionRef.current) closeMention();
            return;
          }
          const query = atMatch[1] ?? "";
          const coords = view.coordsAtPos(from);
          const hostRect = root.getBoundingClientRect();
          setMention({
            query,
            top: coords.bottom - hostRect.top + 4,
            left: coords.left - hostRect.left,
            activeIndex: 0,
          });
        };

        dom.addEventListener("keydown", onKeyDown);
        dom.addEventListener("input", onInput);
      });
    }).catch((err: unknown) => {
      console.error("Marloth editor failed to initialize:", err);
      if (!destroyed) {
        setInitError(err instanceof Error ? err.message : String(err));
      }
    });

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const recordTarget = resolveNodeLinkTarget(anchor.getAttribute("href") ?? "");
      if (!recordTarget) return;
      event.preventDefault();
      event.stopPropagation();
      const openInNewTab = event.metaKey || event.ctrlKey || event.button === 1;
      onNavigate?.(recordTarget, openInNewTab);
      if (api.host === "vscode") {
        api.navigate(recordTarget, openInNewTab);
      }
    };

    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      const recordTarget = resolveNodeLinkTarget(href);
      if (!recordTarget) return;
      event.preventDefault();
      const action = window.prompt(
        "Marloth link — enter new title (Cancel to keep unchanged):",
        anchor.textContent ?? "",
      );
      if (action === null) return;
      const trimmed = action.trim();
      if (!trimmed) return;
      anchor.textContent = trimmed;
      anchor.setAttribute("href", marlothHref(recordTarget));
    };

    root.addEventListener("click", onClick);
    root.addEventListener("auxclick", onClick);
    root.addEventListener("contextmenu", onContextMenu);

    return () => {
      destroyed = true;
      root.removeEventListener("click", onClick);
      root.removeEventListener("auxclick", onClick);
      root.removeEventListener("contextmenu", onContextMenu);
      root.replaceChildren();
      void crepe.destroy();
      crepeRef.current = null;
    };
  }, [
    api,
    closeMention,
    initialBody,
    insertMention,
    onEditorBaseline,
    onBodyChange,
    onNavigate,
    nodeId,
    title,
  ]);

  return (
    <div className="marloth-editor-shell">
      {hideTitle ? null : (
        <header className="marloth-editor-header">
          <h1 className="marloth-editor-title">{title}</h1>
        </header>
      )}
      <div
        className={`marloth-editor-body${isEmpty ? " is-empty" : ""}`}
        ref={rootRef}
      />
      {initError ? <div className="marloth-editor-error">{initError}</div> : null}
      {mention ? (
        <div
          className="marloth-mention-menu"
          style={{ top: mention.top, left: mention.left }}
          role="listbox"
        >
          {results.length === 0 ? (
            <div className="marloth-mention-empty">No matching records</div>
          ) : (
            results.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`marloth-mention-item${index === mention.activeIndex ? " is-active" : ""}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertMention(item);
                }}
              >
                <span className="marloth-mention-title">{item.title}</span>
                {item.path ? <span className="marloth-mention-path">{item.path}</span> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

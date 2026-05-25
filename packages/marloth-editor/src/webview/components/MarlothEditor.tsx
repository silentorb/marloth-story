import { useCallback, useEffect, useRef, useState } from "react";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame-dark.css";
import type { EditorApi } from "../api/client";
import {
  formatMarlothLink,
  marlothHref,
} from "../../shared/types";
import type { RecordSummary } from "../../shared/types";
import { installCalloutDecoration } from "../callout-decoration";
import {
  resolveRecordLinkTarget,
  rewriteStandaloneRecordLinks,
} from "../record-links";
import "./editor.css";

interface MentionState {
  query: string;
  top: number;
  left: number;
  activeIndex: number;
}

interface MarlothEditorProps {
  api: EditorApi;
  recordId: string;
  title: string;
  initialBody: string;
  onBodyChange?: (body: string) => void;
  onNavigate?: (recordId: string, openInNewTab?: boolean) => void;
}

export function MarlothEditor({
  api,
  recordId,
  title,
  initialBody,
  onBodyChange,
  onNavigate,
}: MarlothEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [results, setResults] = useState<RecordSummary[]>([]);
  const mentionRef = useRef<MentionState | null>(null);
  mentionRef.current = mention;

  const closeMention = useCallback(() => {
    setMention(null);
    setResults([]);
  }, []);

  const insertMention = useCallback(
    (item: RecordSummary) => {
      const editor = crepeRef.current?.editor;
      if (!editor) return;
      editor.action((ctx) => {
        const view = ctx.get("editorView");
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
    const crepe = new Crepe({
      root,
      defaultValue: initialBody,
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

    crepeRef.current = crepe;

    void crepe.create().then(() => {
      if (destroyed) return;
      const editor = crepe.editor;
      editor.action((ctx) => {
        const view = ctx.get("editorView");
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
            setMention((prev) =>
              prev
                ? { ...prev, activeIndex: Math.min(prev.activeIndex + 1, results.length - 1) }
                : prev,
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
          if (event.key === "Enter" && results[state.activeIndex]) {
            insertMention(results[state.activeIndex]!);
            event.preventDefault();
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

      editor.on((listener) => {
        listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) onBodyChange?.(markdown);
          if (api.host === "standalone") {
            editor.action((ctx) => {
              rewriteStandaloneRecordLinks(ctx.get("editorView").dom);
            });
          }
        });
      });

      if (api.host === "standalone") {
        editor.action((ctx) => {
          rewriteStandaloneRecordLinks(ctx.get("editorView").dom);
        });
      }
    });

    const onClick = api.host === "vscode"
      ? (event: MouseEvent) => {
          const target = event.target as HTMLElement | null;
          const anchor = target?.closest("a") as HTMLAnchorElement | null;
          if (!anchor) return;
          const recordTarget = resolveRecordLinkTarget(anchor.getAttribute("href") ?? "");
          if (!recordTarget) return;
          event.preventDefault();
          event.stopPropagation();
          const openInNewTab = event.metaKey || event.ctrlKey || event.button === 1;
          onNavigate?.(recordTarget, openInNewTab);
          api.navigate(recordTarget, openInNewTab);
        }
      : null;

    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      const recordTarget = resolveRecordLinkTarget(href);
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

    if (onClick) {
      root.addEventListener("click", onClick);
      root.addEventListener("auxclick", onClick);
    }
    root.addEventListener("contextmenu", onContextMenu);

    return () => {
      destroyed = true;
      if (onClick) {
        root.removeEventListener("click", onClick);
        root.removeEventListener("auxclick", onClick);
      }
      root.removeEventListener("contextmenu", onContextMenu);
      void crepe.destroy();
      crepeRef.current = null;
    };
  }, [
    api,
    closeMention,
    initialBody,
    insertMention,
    onBodyChange,
    onNavigate,
    recordId,
    results.length,
    title,
  ]);

  return (
    <div className="marloth-editor-shell">
      <header className="marloth-editor-header">
        <h1 className="marloth-editor-title">{title}</h1>
      </header>
      <div className="marloth-editor-body" ref={rootRef} />
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

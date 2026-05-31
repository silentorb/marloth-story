import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorApi } from "../api/client";
import type { NodeSummary } from "../../shared/types";
import "./global-search.css";

interface GlobalSearchProps {
  api: EditorApi;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenNode: (nodeId: string, openInNewTab?: boolean) => void;
}

export function GlobalSearch({ api, open, onOpenChange, onOpenNode }: GlobalSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NodeSummary[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const openNode = useCallback(
    (nodeId: string, openInNewTab = false) => {
      onOpenNode(nodeId, openInNewTab);
      close();
    },
    [close, onOpenNode],
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setActiveIndex(0);
    setError(null);
    const handle = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!dialogRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    const handle = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void api
        .search(query, 25)
        .then((items) => setResults(items))
        .catch((err) => {
          setResults([]);
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => setLoading(false));
    }, 120);
    return () => window.clearTimeout(handle);
  }, [api, open, query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  if (!open) return null;

  return (
    <div className="marloth-global-search-backdrop">
      <div
        ref={dialogRef}
        className="marloth-global-search"
        role="dialog"
        aria-modal="true"
        aria-label="Search nodes"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="search"
          className="marloth-global-search-input"
          placeholder="Search nodes…"
          value={query}
          aria-controls="marloth-global-search-listbox"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, Math.max(0, results.length - 1)));
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
              return;
            }
            if (event.key === "Enter" && results[activeIndex]) {
              event.preventDefault();
              openNode(
                results[activeIndex]!.id,
                event.metaKey || event.ctrlKey,
              );
            }
          }}
        />
        <div id="marloth-global-search-listbox" className="marloth-global-search-list" role="listbox">
          {error ? <div className="marloth-global-search-error">{error}</div> : null}
          {loading && results.length === 0 ? (
            <div className="marloth-global-search-empty">Searching…</div>
          ) : null}
          {!loading && results.length === 0 ? (
            <div className="marloth-global-search-empty">
              {query.trim() ? "No matching nodes" : "No nodes found"}
            </div>
          ) : (
            results.map((item, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`marloth-global-search-item${isActive ? " is-active" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) =>
                    openNode(item.id, event.metaKey || event.ctrlKey || event.button === 1)
                  }
                  onAuxClick={(event) => {
                    if (event.button === 1) openNode(item.id, true);
                  }}
                >
                  <span className="marloth-global-search-title">{item.title}</span>
                  {item.path ? (
                    <span className="marloth-global-search-path">{item.path}</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
        <div className="marloth-global-search-footer">
          ↑↓ navigate · Enter open · Ctrl/Cmd+Enter open in new tab · Esc close
        </div>
      </div>
    </div>
  );
}

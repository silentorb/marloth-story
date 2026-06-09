import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorApi } from "../api/client";
import type { NodeSummary } from "../../shared/types";
import "./record-link-picker.css";

const DEFAULT_SEARCH_LIMIT = 25;

function sortNodeSummariesByTitle(items: NodeSummary[]): NodeSummary[] {
  return [...items].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true }),
  );
}

interface RecordLinkPickerProps {
  api: EditorApi;
  allowedTypeIds?: string[];
  excludedIds: readonly string[];
  ariaLabel: string;
  onSelect: (nodeId: string, summary?: NodeSummary) => void | Promise<void>;
  onClose: () => void;
  /** When false, keep picker open after a successful selection (default true). */
  closeOnSelect?: boolean;
  /** When true, skip document click-outside handling (parent dialog owns dismissal). */
  embedded?: boolean;
  /** Max search results to request (default 25). */
  searchLimit?: number;
}

export function RecordLinkPicker({
  api,
  allowedTypeIds,
  excludedIds,
  ariaLabel,
  onSelect,
  onClose,
  closeOnSelect = true,
  embedded = false,
  searchLimit = DEFAULT_SEARCH_LIMIT,
}: RecordLinkPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NodeSummary[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const excluded = useRef(new Set(excludedIds));

  excluded.current = new Set(excludedIds);

  useEffect(() => {
    setActiveIndex(0);
  }, [excludedIds]);

  useEffect(() => {
    if (embedded) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [embedded, onClose]);

  useEffect(() => {
    setActiveIndex(0);
    const handle = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void api
        .search(query, searchLimit, allowedTypeIds)
        .then((items) => setResults(sortNodeSummariesByTitle(items)))
        .catch((err) => {
          setResults([]);
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => setLoading(false));
    }, 120);
    return () => window.clearTimeout(handle);
  }, [api, allowedTypeIds, query, searchLimit]);

  const selectable = results.filter((item) => !excluded.current.has(item.id));

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector(".marloth-record-link-picker-item.is-active");
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, selectable]);

  const pick = useCallback(
    async (nodeId: string) => {
      if (excluded.current.has(nodeId) || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const summary = results.find((row) => row.id === nodeId);
        await onSelect(nodeId, summary);
        if (closeOnSelect) {
          onClose();
        } else {
          setQuery("");
          setActiveIndex(0);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    },
    [closeOnSelect, onClose, onSelect, results, submitting],
  );

  return (
    <div
      ref={rootRef}
      className={`marloth-record-link-picker${embedded ? " is-embedded" : ""}`}
      role={embedded ? "group" : "dialog"}
      aria-label={ariaLabel}
    >
      <input
        type="search"
        className="marloth-record-link-picker-search"
        placeholder="Search records…"
        value={query}
        autoFocus={!embedded}
        disabled={submitting}
        aria-controls="marloth-record-link-picker-listbox"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, Math.max(0, selectable.length - 1)));
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
            return;
          }
          if (event.key === "Enter" && selectable[activeIndex]) {
            event.preventDefault();
            void pick(selectable[activeIndex]!.id);
          }
        }}
      />
      <div
        ref={listRef}
        id="marloth-record-link-picker-listbox"
        className="marloth-record-link-picker-list"
        role="listbox"
      >
        {error ? <div className="marloth-record-link-picker-error">{error}</div> : null}
        {loading && selectable.length === 0 ? (
          <div className="marloth-record-link-picker-empty">Searching…</div>
        ) : null}
        {!loading && selectable.length === 0 ? (
          <div className="marloth-record-link-picker-empty">No matching records</div>
        ) : (
          selectable.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isActive}
                disabled={submitting}
                className={`marloth-record-link-picker-item${isActive ? " is-active" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void pick(item.id)}
              >
                <span className="marloth-record-link-picker-title">{item.title}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

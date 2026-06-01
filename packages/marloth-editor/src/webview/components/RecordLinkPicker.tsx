import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorApi } from "../api/client";
import type { NodeSummary } from "../../shared/types";
import "./record-link-picker.css";

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
}: RecordLinkPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NodeSummary[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const excluded = useRef(new Set(excludedIds));

  excluded.current = new Set(excludedIds);

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
        .search(query, 12, allowedTypeIds)
        .then((items) => setResults(items))
        .catch((err) => {
          setResults([]);
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => setLoading(false));
    }, 120);
    return () => window.clearTimeout(handle);
  }, [api, allowedTypeIds, query]);

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
    [closeOnSelect, onClose, onSelect, submitting],
  );

  const selectable = results.filter((item) => !excluded.current.has(item.id));

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
          results.map((item) => {
            const isExcluded = excluded.current.has(item.id);
            const selectableIndex = selectable.findIndex((row) => row.id === item.id);
            const isActive = !isExcluded && selectableIndex === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isActive}
                disabled={isExcluded || submitting}
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

import { useCallback, useState } from "react";
import "./table-add-row-footer.css";

interface TableAddRowFooterProps {
  label: string;
  onSubmit: (title: string) => Promise<void>;
}

export function TableAddRowFooter({ label, onSubmit }: TableAddRowFooterProps) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setExpanded(false);
    setTitle("");
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [onSubmit, reset, title]);

  if (!expanded) {
    return (
      <div className="marloth-table-add-row">
        <button
          type="button"
          className="marloth-table-add-row-trigger"
          onClick={() => setExpanded(true)}
        >
          + {label}
        </button>
      </div>
    );
  }

  return (
    <div className="marloth-table-add-row marloth-table-add-row-form">
      <input
        type="text"
        className="marloth-table-add-row-input"
        placeholder="Name"
        value={title}
        autoFocus
        disabled={submitting}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void submit();
          if (event.key === "Escape") reset();
        }}
      />
      <div className="marloth-table-add-row-actions">
        <button
          type="button"
          className="marloth-btn-secondary"
          onClick={reset}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="marloth-btn-primary"
          onClick={() => void submit()}
          disabled={submitting}
        >
          {submitting ? "Adding…" : "Add"}
        </button>
      </div>
      {error ? <div className="marloth-table-add-row-error">{error}</div> : null}
    </div>
  );
}

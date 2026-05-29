import { useCallback, useState } from "react";
import type { EditorApi } from "../api/client";
import { PageTitle } from "./PageTitle";
import "./create-node-view.css";

interface CreateNodeViewProps {
  api: EditorApi;
  onCancel: () => void;
  onCreated: (nodeId: string) => void;
}

export function CreateNodeView({ api, onCancel, onCreated }: CreateNodeViewProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const node = await api.createNode({
        title: trimmed,
        body: body.trim() ? body : undefined,
      });
      onCreated(node.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [api, body, onCreated, title]);

  return (
    <div className="marloth-create-node">
      <header className="marloth-create-node-header">
        <h1 className="marloth-create-node-heading">New page</h1>
        <div className="marloth-create-node-actions">
          <button type="button" className="marloth-btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="marloth-btn-primary" onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </header>
      {error ? <div className="marloth-create-node-error">{error}</div> : null}
      <div className="marloth-create-node-form">
        <PageTitle value={title} onChange={setTitle} />
        <label className="marloth-create-node-body-label">
          <span>Body (optional)</span>
          <textarea
            className="marloth-create-node-body"
            value={body}
            rows={12}
            placeholder="Markdown body…"
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

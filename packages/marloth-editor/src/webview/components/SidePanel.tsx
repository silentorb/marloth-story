import { useState } from "react";
import type { AppView } from "../../shared/types";
import "./side-panel.css";

interface SidePanelProps {
  activeView: AppView;
  onHome: () => void;
  onViewChange: (view: AppView) => void;
}

export function SidePanel({ activeView, onHome, onViewChange }: SidePanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`marloth-side-panel${collapsed ? " is-collapsed" : ""}`}
      aria-label="Navigation"
    >
      <div className="marloth-side-panel-header">
        <button
          type="button"
          className="marloth-side-panel-toggle"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="marloth-side-panel-toggle-icon" aria-hidden="true">
            {collapsed ? "›" : "‹"}
          </span>
        </button>
      </div>
      <nav className="marloth-side-panel-nav">
        <button
          type="button"
          className={`marloth-side-panel-item${activeView === "record" ? " is-active" : ""}`}
          onClick={onHome}
          title="Home"
        >
          <span className="marloth-side-panel-item-icon" aria-hidden="true">
            ⌂
          </span>
          <span className="marloth-side-panel-item-label">Home</span>
        </button>
        <button
          type="button"
          className={`marloth-side-panel-item${activeView === "graph-overview" ? " is-active" : ""}`}
          onClick={() => onViewChange("graph-overview")}
          title="Graph Overview"
        >
          <span className="marloth-side-panel-item-icon" aria-hidden="true">
            ◉
          </span>
          <span className="marloth-side-panel-item-label">Graph Overview</span>
        </button>
        <button
          type="button"
          className={`marloth-side-panel-item${activeView === "graph-explorer" ? " is-active" : ""}`}
          onClick={() => onViewChange("graph-explorer")}
          title="Graph Explorer"
        >
          <span className="marloth-side-panel-item-icon" aria-hidden="true">
            ⊕
          </span>
          <span className="marloth-side-panel-item-label">Graph Explorer</span>
        </button>
      </nav>
    </aside>
  );
}

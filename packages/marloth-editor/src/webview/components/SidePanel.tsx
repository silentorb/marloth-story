import { useState } from "react";
import type { AppView } from "../../shared/types";
import type { EditorApi } from "../api/client";
import { nodePageHref } from "../node-links";
import { SIDEBAR_NODE_LINKS } from "../sidebar-nav";
import "./side-panel.css";

export interface SidePanelStandaloneUrls {
  home: string;
  explorer: string;
  create: string;
  nodes: Record<string, string>;
}

export function isHomeNavActive(
  activeView: AppView,
  activeNodeId: string | null | undefined,
  homeNodeId: string | null | undefined,
): boolean {
  if (activeView !== "node-page" || !activeNodeId || !homeNodeId) return false;
  return activeNodeId.toLowerCase() === homeNodeId.toLowerCase();
}

interface SidePanelProps {
  api: EditorApi;
  activeView: AppView;
  activeNodeId?: string | null;
  homeNodeId?: string | null;
  onViewChange: (view: AppView) => void;
  onNewPage: () => void;
  onOpenSearch: () => void;
  standaloneUrls?: SidePanelStandaloneUrls;
}

function NavItem({
  active,
  title,
  icon,
  label,
  href,
  onClick,
}: {
  active: boolean;
  title: string;
  icon: string;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const className = `marloth-side-panel-item${active ? " is-active" : ""}`;
  if (href) {
    return (
      <a className={className} href={href} title={title}>
        <span className="marloth-side-panel-item-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="marloth-side-panel-item-label">{label}</span>
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} title={title}>
      <span className="marloth-side-panel-item-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="marloth-side-panel-item-label">{label}</span>
    </button>
  );
}

export function SidePanel({
  api,
  activeView,
  activeNodeId,
  homeNodeId,
  onViewChange,
  onNewPage,
  onOpenSearch,
  standaloneUrls,
}: SidePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pageBase = typeof window !== "undefined" ? window.location.href : undefined;

  const homeHref =
    standaloneUrls?.home ??
    (homeNodeId ? nodePageHref(homeNodeId, api.host, pageBase) : undefined);

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
        <NavItem
          active={isHomeNavActive(activeView, activeNodeId, homeNodeId)}
          title="Home"
          icon="⌂"
          label="Home"
          href={homeHref}
        />
        <NavItem
          active={false}
          title="Search nodes (Ctrl+K)"
          icon="⌕"
          label="Search"
          onClick={onOpenSearch}
        />
        <NavItem
          active={activeView === "graph-explorer"}
          title="Graph Explorer"
          icon="⊕"
          label="Graph Explorer"
          href={standaloneUrls?.explorer}
          onClick={standaloneUrls ? undefined : () => onViewChange("graph-explorer")}
        />
        <NavItem
          active={false}
          title="New page"
          icon="+"
          label="New page"
          href={standaloneUrls?.create}
          onClick={standaloneUrls ? undefined : onNewPage}
        />
        <div className="marloth-side-panel-divider" role="presentation" />
        {SIDEBAR_NODE_LINKS.map(({ id, label, icon }) => (
          <NavItem
            key={id}
            active={activeView === "node-page" && activeNodeId === id}
            title={label}
            icon={icon}
            label={label}
            href={standaloneUrls?.nodes[id] ?? nodePageHref(id, api.host, pageBase)}
          />
        ))}
      </nav>
    </aside>
  );
}

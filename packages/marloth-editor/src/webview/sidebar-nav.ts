import type { AppView } from "../shared/types";

export interface SidebarNodeLink {
  id: string;
  label: string;
  icon: string;
}

export const HOME_ICON = "⌂";

export const VIEW_ICONS: Record<Exclude<AppView, "node-page">, string> = {
  "graph-explorer": "⊕",
  "create-node": "+",
};

/** Quick navigation targets in the side panel (Notion database / page ids). */
export const SIDEBAR_NODE_LINKS: readonly SidebarNodeLink[] = [
  { id: "dd0de9867cc345b898929306bdf9fc83", label: "Features", icon: "★" },
  { id: "528384943746443a9c89699b57e3bbec", label: "Solutions", icon: "✓" },
  { id: "204dba198db74611b0b49a98dd53e8f5", label: "Scenes", icon: "▶" },
  { id: "2eea538996934ce8abafc27132e576c1", label: "Inspirations", icon: "✦" },
  { id: "5a585a2a311c4768be4a81f27bdcdfb4", label: "Articles", icon: "§" },
  { id: "f984a934ad644f8480b0f8f51449569f", label: "Characters", icon: "◎" },
  { id: "df096ab26e8347e6992e95698345aad0", label: "Locations", icon: "⌖" },
];

export const SIDEBAR_ICON_BY_NODE_ID: Readonly<Record<string, string>> = Object.fromEntries(
  SIDEBAR_NODE_LINKS.map(({ id, icon }) => [id, icon]),
);

export const SIDEBAR_ICON_BY_LABEL: Readonly<Record<string, string>> = Object.fromEntries(
  SIDEBAR_NODE_LINKS.map(({ label, icon }) => [label, icon]),
);

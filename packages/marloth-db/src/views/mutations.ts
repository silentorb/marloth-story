import type { ContentStore } from "../content/store";
import {
  emptyViewsFile,
  slugifyTabId,
  uniqueTabId,
  type CustomTabDefinition,
  type ViewSortSpec,
  type ViewsFile,
} from "../content/views-file";
import { ITEMS_SECTION_KEY } from "./resolve-tabs";

export type ViewsMutationError =
  | "node_not_found"
  | "section_not_found"
  | "tab_not_found"
  | "last_tab"
  | "invalid_name"
  | "not_custom_tabs";

function ensureCustomSection(
  file: ViewsFile,
  nodeId: string,
  sectionKey: string,
): CustomTabDefinition[] {
  const node = file.nodes[nodeId];
  const section = node?.sections[sectionKey];
  if (!section || section.tabs.kind !== "custom") {
    throw new Error("not_custom_tabs");
  }
  return section.tabs.definitions;
}

function writeViews(store: ContentStore, file: ViewsFile): void {
  store.writeViewsFile(file);
}

export function getNodeViews(store: ContentStore, nodeId: string): ViewsFile["nodes"][string] | null {
  const file = store.readViewsFile();
  return file.nodes[nodeId] ?? null;
}

export function createTab(
  store: ContentStore,
  nodeId: string,
  sectionKey: string,
  input: { name: string; sorts?: ViewSortSpec[] },
): CustomTabDefinition {
  const trimmed = input.name.trim();
  if (!trimmed) throw new Error("invalid_name");

  const file = store.readViewsFile();
  let node = file.nodes[nodeId];
  if (!node) {
    node = { sections: {} };
    file.nodes[nodeId] = node;
  }

  let definitions: CustomTabDefinition[];
  const existing = node.sections[sectionKey];
  if (existing?.tabs.kind === "custom") {
    definitions = existing.tabs.definitions;
  } else {
    definitions = [];
    node.sections[sectionKey] = { tabs: { kind: "custom", definitions } };
  }

  const existingIds = new Set(definitions.map((tab) => tab.id));
  const id = uniqueTabId(slugifyTabId(trimmed), existingIds);
  const tab: CustomTabDefinition = {
    id,
    name: trimmed,
    sorts: input.sorts ?? [{ column: "name", direction: "asc" }],
  };
  definitions.push(tab);
  writeViews(store, file);
  return tab;
}

export function updateTab(
  store: ContentStore,
  nodeId: string,
  sectionKey: string,
  tabId: string,
  input: { name?: string; sorts?: ViewSortSpec[] },
): CustomTabDefinition {
  const file = store.readViewsFile();
  const definitions = ensureCustomSection(file, nodeId, sectionKey);
  const tab = definitions.find((entry) => entry.id === tabId);
  if (!tab) throw new Error("tab_not_found");

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new Error("invalid_name");
    tab.name = trimmed;
  }
  if (input.sorts !== undefined) {
    tab.sorts = input.sorts;
  }

  writeViews(store, file);
  return tab;
}

export function deleteTab(
  store: ContentStore,
  nodeId: string,
  sectionKey: string,
  tabId: string,
): void {
  const file = store.readViewsFile();
  const definitions = ensureCustomSection(file, nodeId, sectionKey);
  if (definitions.length <= 1) throw new Error("last_tab");

  const index = definitions.findIndex((entry) => entry.id === tabId);
  if (index < 0) throw new Error("tab_not_found");
  definitions.splice(index, 1);
  writeViews(store, file);
}

export function ensureCustomItemsSection(
  store: ContentStore,
  nodeId: string,
  definitions: CustomTabDefinition[],
): void {
  const file = store.readViewsFile();
  file.nodes[nodeId] = {
    sections: {
      [ITEMS_SECTION_KEY]: {
        tabs: { kind: "custom", definitions },
      },
    },
  };
  writeViews(store, file);
}

export function ensureGeneratedItemsSection(
  store: ContentStore,
  nodeId: string,
  provider: string,
): void {
  const file = store.readViewsFile();
  file.nodes[nodeId] = {
    sections: {
      [ITEMS_SECTION_KEY]: {
        tabs: { kind: "generated", provider },
      },
    },
  };
  writeViews(store, file);
}

export function replaceViewsFile(store: ContentStore, file: ViewsFile): void {
  writeViews(store, file);
}

export function readViewsFileOrEmpty(store: ContentStore): ViewsFile {
  try {
    return store.readViewsFile();
  } catch {
    return emptyViewsFile();
  }
}

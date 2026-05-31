import type { MarlothWriteContext } from "marloth-db";
import {
  createTab,
  deleteTab,
  getNodeViews,
  updateTab,
  updateSectionColumnOrder,
  reorderSectionTabs,
  type ViewSortSpec,
} from "marloth-db";
import { invalidateViewsCache } from "marloth-db";
import { ITEMS_SECTION_KEY } from "marloth-db";

export interface TabMutationInput {
  name?: string;
  sorts?: ViewSortSpec[];
}

export function readNodeViews(ctx: MarlothWriteContext, nodeId: string) {
  invalidateViewsCache();
  return getNodeViews(ctx.store, nodeId);
}

export function createSectionTab(
  ctx: MarlothWriteContext,
  nodeId: string,
  sectionKey: string,
  input: { name: string; sorts?: ViewSortSpec[] },
) {
  invalidateViewsCache();
  ctx.sync.syncFile("views.json");
  return createTab(ctx.store, nodeId, sectionKey, input);
}

export function updateSectionTab(
  ctx: MarlothWriteContext,
  nodeId: string,
  sectionKey: string,
  tabId: string,
  input: TabMutationInput,
) {
  invalidateViewsCache();
  ctx.sync.syncFile("views.json");
  return updateTab(ctx.store, nodeId, sectionKey, tabId, input);
}

export function deleteSectionTab(
  ctx: MarlothWriteContext,
  nodeId: string,
  sectionKey: string,
  tabId: string,
) {
  invalidateViewsCache();
  ctx.sync.syncFile("views.json");
  deleteTab(ctx.store, nodeId, sectionKey, tabId);
}

export function patchSectionColumnOrder(
  ctx: MarlothWriteContext,
  nodeId: string,
  sectionKey: string,
  columnOrder: string[],
) {
  invalidateViewsCache();
  ctx.sync.syncFile("views.json");
  return updateSectionColumnOrder(ctx.store, nodeId, sectionKey, columnOrder);
}

export function patchSectionTabOrder(
  ctx: MarlothWriteContext,
  nodeId: string,
  sectionKey: string,
  tabOrder: string[],
) {
  invalidateViewsCache();
  ctx.sync.syncFile("views.json");
  return reorderSectionTabs(ctx.store, nodeId, sectionKey, tabOrder);
}

export { ITEMS_SECTION_KEY };

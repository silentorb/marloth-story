import type { EditorApi } from "../api/client";
import { emptySchemaFile } from "marloth-db/schema-file";
import { emptyUserSettings } from "../../shared/user-settings";
import { makeGraphLodSnapshot } from "./graph-lod";
import { makeDatabaseViewDetail } from "./node-page";

export function makeMockEditorApi(host: "standalone" | "vscode" = "standalone"): EditorApi {
  return {
    host,
    getHomeId: async () => "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    createNode: async (input) => ({ id: "cccccccccccccccccccccccccccccccc", title: input.title }),
    createRelationRow: async (_sourceId, input) => ({
      id: "dddddddddddddddddddddddddddddddd",
      title: input.title,
    }),
    createDatabaseRow: async (_databaseId, input) => ({
      id: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      title: input.title,
    }),
    getNode: async () => {
      throw new Error("not implemented in mock");
    },
    getDatabaseView: async (databaseId, tabId) => {
      void databaseId;
      void tabId;
      return makeDatabaseViewDetail();
    },
    createSectionTab: async (_nodeId, _sectionKey, input) => ({
      id: "new-tab",
      name: input.name,
      sorts: input.sorts ?? [{ column: "name", direction: "asc" as const }],
    }),
    updateSectionTab: async (_nodeId, _sectionKey, tabId, input) => ({
      id: tabId,
      name: input.name ?? tabId,
      sorts: input.sorts ?? [{ column: "name", direction: "asc" as const }],
    }),
    deleteSectionTab: async () => {},
    updateSectionColumnOrder: async (_nodeId, _sectionKey, columnOrder) => columnOrder,
    updateSectionTabOrder: async (_nodeId, _sectionKey, tabOrder) =>
      tabOrder.map((id) => ({
        id,
        name: id,
        sorts: [{ column: "name", direction: "asc" as const }],
      })),
    deleteDatabaseColumn: async () => ({ rowsAffected: 0, relationsUnlinked: 0 }),
    search: async () => [],
    saveBody: async () => {},
    saveTitle: async () => {},
    updateDatabaseRowProperty: async () => {},
    updateOutgoingRelationshipProperty: async () => {},
    linkOutgoingRelationship: async () => {},
    unlinkOutgoingRelationship: async () => {},
    deleteNode: async () => {},
    archiveNode: async () => {},
    getGraphFull: async () => ({ nodes: [], relationships: [] }),
    getGraphExplorerLod: async () => makeGraphLodSnapshot(),
    getSchema: async () => emptySchemaFile(),
    listRelationshipTypes: async () => ["features", "inspirations"],
    getRelationshipLinkOptions: async () => ({ allowedTargetTypeIds: null }),
    getUserSettings: async () => emptyUserSettings(),
    patchUserSettings: async () => emptyUserSettings(),
    moveOrderedAssociation: async () => {
      throw new Error("not implemented in mock");
    },
    navigate: () => {},
  };
}

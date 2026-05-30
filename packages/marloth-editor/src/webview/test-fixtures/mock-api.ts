import type { EditorApi } from "../api/client";
import { emptyUserSettings } from "../../shared/user-settings";
import { makeGraphLodSnapshot } from "./graph-lod";

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
    getDatabaseView: async () => {
      throw new Error("not implemented in mock");
    },
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
    getUserSettings: async () => emptyUserSettings(),
    patchUserSettings: async () => emptyUserSettings(),
    moveOrderedAssociation: async () => {
      throw new Error("not implemented in mock");
    },
    navigate: () => {},
  };
}

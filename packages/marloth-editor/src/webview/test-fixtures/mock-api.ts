import type { EditorApi } from "../api/client";
import { emptyUserSettings } from "../../shared/user-settings";
import { makeGraphLodSnapshot } from "./graph-lod";

export function makeMockEditorApi(host: "standalone" | "vscode" = "standalone"): EditorApi {
  return {
    host,
    getHomeId: async () => "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    getRecord: async () => {
      throw new Error("not implemented in mock");
    },
    getDatabaseView: async () => {
      throw new Error("not implemented in mock");
    },
    search: async () => [],
    saveBody: async () => {},
    saveTitle: async () => {},
    deleteRecord: async () => {},
    archiveRecord: async () => {},
    getGraphFull: async () => ({ nodes: [], links: [] }),
    getGraphExplorerLod: async () => makeGraphLodSnapshot(),
    getUserSettings: async () => emptyUserSettings(),
    patchUserSettings: async () => emptyUserSettings(),
    moveOrderedAssociation: async () => {
      throw new Error("not implemented in mock");
    },
    navigate: () => {},
  };
}

import type { EditorApi } from "../api/client";
import { emptyUserSettings } from "../../shared/user-settings";

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
    getGraphExplorerLod: async () => ({
      layerCount: 5,
      levels: [
        { nodes: [], links: [] },
        { nodes: [], links: [] },
        { nodes: [], links: [] },
        { nodes: [], links: [] },
        { nodes: [], links: [] },
      ],
    }),
    getUserSettings: async () => emptyUserSettings(),
    patchUserSettings: async () => emptyUserSettings(),
    moveOrderedAssociation: async () => {
      throw new Error("not implemented in mock");
    },
    navigate: () => {},
  };
}

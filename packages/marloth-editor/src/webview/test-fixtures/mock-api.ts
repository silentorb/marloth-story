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
    getGraphOverview: async () => ({ nodes: [], links: [] }),
    getGraphFull: async () => ({ nodes: [], links: [] }),
    getUserSettings: async () => emptyUserSettings(),
    patchUserSettings: async () => emptyUserSettings(),
    navigate: () => {},
  };
}

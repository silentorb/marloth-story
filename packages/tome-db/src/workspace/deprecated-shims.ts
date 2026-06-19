import { loadWorkspace } from "./load";

/** @deprecated Use loadWorkspace().homeNodeId */
export const DEFAULT_HOME_NODE_ID = loadWorkspace().homeNodeId;

/** @deprecated Use loadWorkspace().archiveNodeId */
export const DEFAULT_ARCHIVE_NODE_ID = loadWorkspace().archiveNodeId;

/** @deprecated Use loadWorkspace().graphExplorer.defaultAnchorNodeId */
export const DEFAULT_GRAPH_EXPLORER_ANCHOR_ID = loadWorkspace().graphExplorer.defaultAnchorNodeId;

/** @deprecated Use loadWorkspace().legacy?.archivePathPrefix */
export const ARCHIVE_NOTION_PATH_PREFIX = loadWorkspace().legacy?.archivePathPrefix ?? "Marloth/Archive";

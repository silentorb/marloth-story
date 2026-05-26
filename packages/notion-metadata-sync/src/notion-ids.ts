const HEX32 = /^[a-f0-9]{32}$/i;

export function isNotionHexId(id: string): boolean {
  return HEX32.test(id);
}

/** Format 32-hex Notion id as UUID for API paths. */
export function notionIdToUuid(hexId: string): string {
  const id = hexId.toLowerCase();
  if (!isNotionHexId(id)) {
    throw new Error(`Invalid Notion id (expected 32 hex chars): ${hexId}`);
  }
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

/** Normalize API id (with or without dashes) to 32-hex. */
export function notionIdToHex(id: string): string {
  const compact = id.replace(/-/g, "").toLowerCase();
  if (!isNotionHexId(compact)) {
    throw new Error(`Invalid Notion id: ${id}`);
  }
  return compact;
}

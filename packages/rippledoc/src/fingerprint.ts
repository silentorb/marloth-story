import { stat } from "node:fs/promises";

export function fingerprintFromStat(
  mtimeMs: number,
  size: number,
): string {
  return `${mtimeMs}:${size}`;
}

export async function statFingerprint(
  absPath: string,
): Promise<string> {
  const s = await stat(absPath);
  return fingerprintFromStat(s.mtimeMs, s.size);
}

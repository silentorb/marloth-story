/**
 * Single side-effect entry for “file X changed; update related files.”
 * The audit (warn-only) path must not call this.
 */
export type ChangeKind = "add" | "change" | "unlink";

export async function runPipelineForPath(
  absPath: string,
  kind: ChangeKind,
): Promise<void> {
  console.log(`[rippledoc] pipeline ${kind} ${absPath}`);
}

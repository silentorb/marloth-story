import { runGraphImport, type GraphRunOptions } from "./graph-pipeline";

export interface RunOptions extends GraphRunOptions {}

export async function run(opts: RunOptions): Promise<void> {
  await runGraphImport(opts);
}

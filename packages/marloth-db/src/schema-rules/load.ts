import { existsSync, readFileSync, statSync } from "node:fs";
import { schemaFilePath as contentSchemaFilePath } from "../content/paths";
import { emptySchemaFile, parseSchemaFile, type SchemaFile } from "./schema-file";

let cachedSchema: { mtimeMs: number; file: SchemaFile } | null = null;

export function invalidateSchemaCache(): void {
  cachedSchema = null;
}

export function loadSchemaFromContent(contentDir: string): SchemaFile {
  const path = contentSchemaFilePath(contentDir);
  let mtimeMs = 0;
  if (existsSync(path)) {
    mtimeMs = statSync(path).mtimeMs;
  }

  if (cachedSchema && cachedSchema.mtimeMs === mtimeMs) {
    return cachedSchema.file;
  }

  let file: SchemaFile;
  try {
    file = parseSchemaFile(readFileSync(path, "utf-8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      file = emptySchemaFile();
    } else {
      throw err;
    }
  }

  cachedSchema = { mtimeMs, file };
  return file;
}

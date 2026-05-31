/// <reference path="../node_modules/astro/client.d.ts" />

interface ImportMetaEnv {
  readonly MARLOTH_CONTENT_PATH?: string;
  readonly MARLOTH_DB_PATH?: string;
  readonly MARLOTH_WEB_OUT_DIR?: string;
  readonly MARLOTH_WEB_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SITE_LAUNCH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

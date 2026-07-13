/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GTM container id, e.g. "GTM-XXXXXXX". Configured in GTM itself, not hard-coded here. */
  readonly VITE_GTM_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_TENANT_ID?: string;
  readonly VITE_WORKSPACE_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

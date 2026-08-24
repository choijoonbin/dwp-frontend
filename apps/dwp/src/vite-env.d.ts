/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_TENANT_ID?: string;
  readonly VITE_WORKSPACE_NAME?: string;
  readonly VITE_WEB_VITALS_ENDPOINT?: string;
  readonly VITE_PRODUCT_SURFACE_TELEMETRY_COLLECTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Deployed backend origin (e.g. "https://your-app.azurewebsites.net"). Unset in dev - Vite proxies "/api" instead. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute base URL for the API, e.g. https://api.example.com/api.
   *  Optional — falls back to the relative "/api" (dev proxy or host rewrite). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

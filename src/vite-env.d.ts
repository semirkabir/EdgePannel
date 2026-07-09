/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __APP_BUILD_TARGET__: 'desktop' | 'web';
declare const __APP_BUILD_VARIANT__: string;

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_WS_API_URL?: string;
  readonly VITE_DESKTOP_RUNTIME?: string;
  readonly VITE_TAURI_API_BASE_URL?: string;
  readonly VITE_TAURI_REMOTE_API_BASE_URL?: string;
  readonly VITE_CONVEX_URL?: string;
  readonly VITE_FINNHUB_API_KEY?: string;
  readonly VITE_OPENFIGI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

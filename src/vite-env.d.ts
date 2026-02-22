/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_FOCUSOS_EXTENSION_ID?: string;
  readonly VITE_FOCUSOS_EXTENSION_IDS?: string;
  readonly VITE_FOCUSOS_CHROME_EXTENSION_ID?: string;
  readonly VITE_FOCUSOS_EDGE_EXTENSION_ID?: string;
  readonly VITE_FOCUSOS_BRAVE_EXTENSION_ID?: string;
  readonly VITE_FOCUSOS_EXTENSION_INSTALL_URL?: string;
  readonly VITE_FOCUSOS_CHROME_INSTALL_URL?: string;
  readonly VITE_FOCUSOS_EDGE_INSTALL_URL?: string;
  readonly VITE_FOCUSOS_BRAVE_INSTALL_URL?: string;
  readonly VITE_FOCUSOS_EXTENSION_ZIP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ChromeRuntime {
  sendMessage(extensionId: string, message: unknown, callback?: (response: unknown) => void): void;
  lastError?: { message?: string };
}

interface Chrome {
  runtime: ChromeRuntime;
}

interface Window {
  chrome?: Chrome;
}

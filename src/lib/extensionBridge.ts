type BrowserKind = "edge" | "brave" | "chrome" | "chromium" | "unsupported";
type StoreBrowser = "chrome" | "edge" | "brave";

export type ExtensionInstallTargetId = StoreBrowser | "zip";

export interface ExtensionInstallTarget {
  id: ExtensionInstallTargetId;
  label: string;
  kind: "store" | "download";
  url?: string;
}

const LEGACY_EXTENSION_ID = (import.meta.env.VITE_FOCUSOS_EXTENSION_ID || "").trim();
const SHARED_EXTENSION_IDS = (import.meta.env.VITE_FOCUSOS_EXTENSION_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const CHROME_EXTENSION_ID = (import.meta.env.VITE_FOCUSOS_CHROME_EXTENSION_ID || "").trim();
const EDGE_EXTENSION_ID = (import.meta.env.VITE_FOCUSOS_EDGE_EXTENSION_ID || "").trim();
const BRAVE_EXTENSION_ID = (import.meta.env.VITE_FOCUSOS_BRAVE_EXTENSION_ID || "").trim();

const LEGACY_INSTALL_URL = (import.meta.env.VITE_FOCUSOS_EXTENSION_INSTALL_URL || "").trim();
const CHROME_INSTALL_URL = (import.meta.env.VITE_FOCUSOS_CHROME_INSTALL_URL || "").trim();
const EDGE_INSTALL_URL = (import.meta.env.VITE_FOCUSOS_EDGE_INSTALL_URL || "").trim();
const BRAVE_INSTALL_URL = (import.meta.env.VITE_FOCUSOS_BRAVE_INSTALL_URL || "").trim();
const EXTENSION_ZIP_URL = (import.meta.env.VITE_FOCUSOS_EXTENSION_ZIP_URL || "/focusos-extension.zip").trim();

const EXTENSION_ID_STORAGE_KEY = "focusos_extension_id";

function hasChromeRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.chrome?.runtime?.sendMessage);
}

function detectBrowserKind(): BrowserKind {
  if (typeof window === "undefined") {
    return "unsupported";
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const nav = window.navigator as Navigator & { brave?: unknown };

  if (ua.includes("edg/")) {
    return "edge";
  }

  if (Boolean(nav.brave)) {
    return "brave";
  }

  if (ua.includes("chrome/") || ua.includes("chromium/")) {
    return "chrome";
  }

  if (ua.includes("safari/") || ua.includes("firefox/")) {
    return "unsupported";
  }

  return "chromium";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function getInstallUrlFor(browser: StoreBrowser): string {
  if (browser === "chrome") {
    return CHROME_INSTALL_URL || LEGACY_INSTALL_URL;
  }

  if (browser === "edge") {
    return EDGE_INSTALL_URL || LEGACY_INSTALL_URL || CHROME_INSTALL_URL;
  }

  return BRAVE_INSTALL_URL || CHROME_INSTALL_URL || LEGACY_INSTALL_URL;
}

function getStoredExtensionId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem(EXTENSION_ID_STORAGE_KEY)?.trim() || "";
}

function getCandidateExtensionIds(): string[] {
  const browser = detectBrowserKind();
  const stored = getStoredExtensionId();

  if (browser === "edge") {
    return unique([stored, EDGE_EXTENSION_ID, LEGACY_EXTENSION_ID, ...SHARED_EXTENSION_IDS, CHROME_EXTENSION_ID]);
  }

  if (browser === "brave") {
    return unique([stored, BRAVE_EXTENSION_ID, CHROME_EXTENSION_ID, LEGACY_EXTENSION_ID, ...SHARED_EXTENSION_IDS]);
  }

  if (browser === "chrome") {
    return unique([stored, CHROME_EXTENSION_ID, LEGACY_EXTENSION_ID, ...SHARED_EXTENSION_IDS, BRAVE_EXTENSION_ID]);
  }

  if (browser === "chromium") {
    return unique([stored, LEGACY_EXTENSION_ID, ...SHARED_EXTENSION_IDS, CHROME_EXTENSION_ID, EDGE_EXTENSION_ID, BRAVE_EXTENSION_ID]);
  }

  return unique([stored, LEGACY_EXTENSION_ID, ...SHARED_EXTENSION_IDS, CHROME_EXTENSION_ID, EDGE_EXTENSION_ID, BRAVE_EXTENSION_ID]);
}

function getPreferredInstallUrl(): string {
  const browser = detectBrowserKind();

  if (browser === "edge") {
    return getInstallUrlFor("edge");
  }

  if (browser === "brave") {
    return getInstallUrlFor("brave");
  }

  if (browser === "chrome") {
    return getInstallUrlFor("chrome");
  }

  if (browser === "chromium") {
    return LEGACY_INSTALL_URL || getInstallUrlFor("chrome") || getInstallUrlFor("edge");
  }

  return LEGACY_INSTALL_URL;
}

function triggerZipDownload(): void {
  if (typeof window === "undefined") {
    return;
  }

  const anchor = document.createElement("a");
  anchor.href = EXTENSION_ZIP_URL;
  anchor.download = "focusos-extension.zip";
  anchor.click();
}

function sendMessage(extensionId: string, message: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    window.chrome?.runtime?.sendMessage(extensionId, message, (response: unknown) => {
      if (window.chrome?.runtime?.lastError) {
        reject(new Error(window.chrome.runtime.lastError.message || "Failed to send extension message"));
        return;
      }
      resolve(response);
    });
  });
}

async function sendMessageToAny(message: unknown): Promise<{ extensionId: string; response: any } | null> {
  const candidates = getCandidateExtensionIds();

  for (const extensionId of candidates) {
    try {
      const response = await sendMessage(extensionId, message);
      if (response) {
        setExtensionId(extensionId);
      }
      return { extensionId, response };
    } catch {
      continue;
    }
  }

  return null;
}

export function getExtensionId(): string {
  return getCandidateExtensionIds()[0] || "";
}

export function hasConfiguredExtensionId(): boolean {
  return getCandidateExtensionIds().length > 0;
}

export function isExtensionRuntimeSupported(): boolean {
  return hasChromeRuntime();
}

export function getExtensionInstallUrl(): string {
  return getPreferredInstallUrl();
}

export function getExtensionInstallTargets(): ExtensionInstallTarget[] {
  const targets: ExtensionInstallTarget[] = [
    { id: "chrome", label: "Chrome", kind: "store", url: getInstallUrlFor("chrome") || undefined },
    { id: "edge", label: "Edge", kind: "store", url: getInstallUrlFor("edge") || undefined },
    { id: "brave", label: "Brave", kind: "store", url: getInstallUrlFor("brave") || undefined },
    { id: "zip", label: "Download ZIP", kind: "download" }
  ];

  return targets.filter((target) => target.id === "zip" || Boolean(target.url));
}

export function getBrowserLabel(): string {
  const browser = detectBrowserKind();
  if (browser === "edge") {
    return "Microsoft Edge";
  }
  if (browser === "brave") {
    return "Brave";
  }
  if (browser === "chrome") {
    return "Google Chrome";
  }
  if (browser === "chromium") {
    return "Chromium";
  }
  return "this browser";
}

export function getExtensionsManagerUrl(): string {
  const browser = detectBrowserKind();
  if (browser === "edge") {
    return "edge://extensions";
  }
  if (browser === "brave") {
    return "brave://extensions";
  }
  return "chrome://extensions";
}

export function openExtensionsManager(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.open(getExtensionsManagerUrl(), "_blank", "noopener,noreferrer");
}

export function openExtensionInstall(): void {
  if (typeof window === "undefined") {
    return;
  }

  const installUrl = getPreferredInstallUrl();

  if (installUrl) {
    window.open(installUrl, "_blank", "noopener,noreferrer");
    return;
  }

  triggerZipDownload();
}

export function openExtensionInstallTarget(targetId: ExtensionInstallTargetId): void {
  if (typeof window === "undefined") {
    return;
  }

  if (targetId === "zip") {
    triggerZipDownload();
    return;
  }

  const installUrl = getInstallUrlFor(targetId);
  if (installUrl) {
    window.open(installUrl, "_blank", "noopener,noreferrer");
    return;
  }

  triggerZipDownload();
}

export function setExtensionId(id: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = id.trim();
  if (!normalized) {
    localStorage.removeItem(EXTENSION_ID_STORAGE_KEY);
    return;
  }
  localStorage.setItem(EXTENSION_ID_STORAGE_KEY, normalized);
}

export async function pingExtension(): Promise<boolean> {
  if (!hasChromeRuntime() || !hasConfiguredExtensionId()) {
    return false;
  }

  const result = await sendMessageToAny({ type: "PING" });
  if (!result) {
    return false;
  }

  return result.response?.installed === true;
}

export async function startFocusMode(allowedSites: string[], sessionEndsAt: string): Promise<boolean> {
  if (!hasChromeRuntime() || !hasConfiguredExtensionId()) {
    return false;
  }

  const result = await sendMessageToAny({
    type: "FOCUS_MODE_START",
    allowedSites,
    sessionEndsAt,
    appOrigin: window.location.origin
  });

  if (!result) {
    return false;
  }

  return result.response?.ok === true;
}

export async function stopFocusMode(): Promise<void> {
  if (!hasChromeRuntime() || !hasConfiguredExtensionId()) {
    return;
  }

  await sendMessageToAny({ type: "FOCUS_MODE_END" });
}

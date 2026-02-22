import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getBrowserLabel,
  getExtensionInstallTargets,
  getExtensionsManagerUrl,
  hasConfiguredExtensionId,
  isExtensionRuntimeSupported,
  openExtensionsManager,
  openExtensionInstallTarget,
  pingExtension
} from "@/lib/extensionBridge";

const EXTENSION_PROMPT_PENDING_KEY = "focusos_extension_prompt_pending";

function dismissedKey(userId: string): string {
  return `focusos_extension_prompt_dismissed_${userId}`;
}

export function ExtensionOnboardingPrompt() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [installStarted, setInstallStarted] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<"chrome" | "edge" | "brave" | "zip" | null>(null);
  const [checking, setChecking] = useState(false);
  const [statusText, setStatusText] = useState("");

  const runtimeSupported = isExtensionRuntimeSupported();
  const extensionConfigured = hasConfiguredExtensionId();
  const browserLabel = getBrowserLabel();
  const installTargets = getExtensionInstallTargets();
  const extensionsManagerUrl = getExtensionsManagerUrl();

  const clearPromptState = useCallback((userId: string) => {
    localStorage.removeItem(EXTENSION_PROMPT_PENDING_KEY);
    localStorage.removeItem(dismissedKey(userId));
  }, []);

  const checkConnection = useCallback(async () => {
    if (!user || !runtimeSupported || !extensionConfigured) {
      return false;
    }

    setChecking(true);
    const connected = await pingExtension();
    setChecking(false);

    if (connected) {
      clearPromptState(user.id);
      setStatusText("Extension connected. Focus mode is ready.");
      setOpen(false);
    }

    return connected;
  }, [user, runtimeSupported, extensionConfigured, clearPromptState]);

  useEffect(() => {
    if (!user) {
      setOpen(false);
      return;
    }

    const pending = localStorage.getItem(EXTENSION_PROMPT_PENDING_KEY) === "1";
    const dismissed = localStorage.getItem(dismissedKey(user.id)) === "1";

    if (!pending || dismissed) {
      return;
    }

    void pingExtension().then((connected) => {
      if (connected) {
        clearPromptState(user.id);
        setOpen(false);
      } else {
        setOpen(true);
      }
    });
  }, [user, clearPromptState]);

  useEffect(() => {
    if (!open || !installStarted || !runtimeSupported || !extensionConfigured) {
      return;
    }

    const timer = window.setInterval(() => {
      void checkConnection();
    }, 2500);

    return () => window.clearInterval(timer);
  }, [open, installStarted, runtimeSupported, extensionConfigured, checkConnection]);

  const onInstall = (targetId: "chrome" | "edge" | "brave" | "zip", label: string) => {
    openExtensionInstallTarget(targetId);
    setInstallStarted(true);
    setSelectedTarget(targetId);
    setStatusText(targetId === "zip"
      ? "Download started. Add the extension to your browser, then return here."
      : `Complete the ${label} extension install, then return here.`);

    if (!runtimeSupported) {
      setStatusText((prev) => `${prev} You need to open FocusOS in Chrome, Edge, or Brave to connect.`);
      return;
    }

    if (!extensionConfigured) {
      setStatusText((prev) => `${prev} Then set extension IDs in app env so FocusOS can connect automatically.`);
      return;
    }

    void checkConnection();
  };

  const onCancel = () => {
    if (user) {
      localStorage.setItem(dismissedKey(user.id), "1");
    }
    setOpen(false);
  };

  const setupHint = useMemo(() => {
    if (!runtimeSupported) {
      return "To use Focus Mode blocking, install in your browser, then open FocusOS in Chrome, Edge, or Brave.";
    }
    if (!extensionConfigured) {
      return "Choose your browser and install the extension. Then configure extension IDs in env for auto-connection.";
    }
    return `Choose where to install. After install in ${browserLabel}, FocusOS should connect automatically.`;
  }, [runtimeSupported, extensionConfigured, browserLabel]);

  const setupSteps = useMemo(() => {
    if (!selectedTarget) {
      return [
        "Choose your browser option below.",
        "Complete install in that browser.",
        "Come back and click I installed it."
      ];
    }

    if (selectedTarget === "zip") {
      return [
        "Open the downloaded ZIP and extract it to a folder.",
        `Open ${extensionsManagerUrl} in your browser.`,
        "Turn on Developer mode (top-right).",
        "Click Load unpacked and select the extracted extension folder.",
        "Return here and click I installed it."
      ];
    }

    return [
      `On the ${selectedTarget} store page, click Add to browser / Get.`,
      "Approve the extension permissions prompt.",
      "Return to FocusOS and click I installed it."
    ];
  }, [selectedTarget, extensionsManagerUrl]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 px-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
        <p className="section-label">QUICK SETUP</p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">FocusOS needs a quick extension install</h2>
        <p className="mt-2 text-sm text-muted-foreground">{setupHint}</p>

        {statusText && (
          <p className="mt-3 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-foreground">
            {statusText}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {installTargets.map((target) => (
            <button
              key={target.id}
              onClick={() => onInstall(target.id, target.label)}
              className={`rounded-lg px-4 py-2 text-sm hover:opacity-90 ${target.id === "zip" ? "border border-border text-muted-foreground" : "bg-primary font-semibold text-primary-foreground"}`}
              disabled={checking}
            >
              {installStarted ? `Open ${target.label} again` : target.label}
            </button>
          ))}

          <button
            onClick={() => void checkConnection()}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
            disabled={checking || !runtimeSupported || !extensionConfigured}
          >
            {checking ? "Checking..." : "I installed it"}
          </button>

          <button
            onClick={openExtensionsManager}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Open Extensions Page
          </button>

          <button
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-background/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step-by-step</p>
          <div className="mt-2 space-y-1 text-sm text-foreground">
            {setupSteps.map((step, index) => (
              <p key={step}>{index + 1}. {step}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

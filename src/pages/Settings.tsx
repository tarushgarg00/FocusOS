import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useFocus } from "@/context/FocusContext";
import { useTheme } from "@/context/ThemeContext";
import {
  getBrowserLabel,
  getExtensionId,
  getExtensionInstallTargets,
  getExtensionsManagerUrl,
  hasConfiguredExtensionId,
  isExtensionRuntimeSupported,
  openExtensionsManager,
  openExtensionInstallTarget,
  pingExtension,
  setExtensionId
} from "@/lib/extensionBridge";
import { supabase } from "@/lib/supabase";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Tokyo"
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { state } = useFocus();
  const { theme, setTheme } = useTheme();

  const [timezone, setTimezone] = useState("America/New_York");
  const [extensionId, setExtensionIdInput] = useState("");
  const [selectedInstallTarget, setSelectedInstallTarget] = useState<"chrome" | "edge" | "brave" | "zip" | null>(null);
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [checkingExtension, setCheckingExtension] = useState(false);
  const [savingTimezone, setSavingTimezone] = useState(false);

  const runtimeSupported = isExtensionRuntimeSupported();
  const extensionConfigured = hasConfiguredExtensionId();
  const browserLabel = getBrowserLabel();
  const installTargets = getExtensionInstallTargets();
  const extensionsManagerUrl = getExtensionsManagerUrl();

  const checkExtensionConnection = async () => {
    setCheckingExtension(true);
    const ok = await pingExtension();
    setExtensionConnected(ok);
    setCheckingExtension(false);
  };

  useEffect(() => {
    setExtensionIdInput(getExtensionId());
    void checkExtensionConnection();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    void supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle()
      .then((result) => {
        if (!result.error && result.data?.timezone) {
          setTimezone(result.data.timezone);
        }
      });
  }, [user]);

  const saveTimezone = async () => {
    if (!user) {
      return;
    }

    setSavingTimezone(true);
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        name: user.name || "FocusOS User",
        timezone,
        week_start_day: 1
      },
      { onConflict: "id" }
    );
    setSavingTimezone(false);
  };

  const handleExtensionSave = async () => {
    setExtensionId(extensionId.trim());
    await checkExtensionConnection();
  };

  const installExtension = (targetId: "chrome" | "edge" | "brave" | "zip") => {
    setSelectedInstallTarget(targetId);
    openExtensionInstallTarget(targetId);
  };

  const setupSteps = useMemo(() => {
    if (!selectedInstallTarget) {
      return [
        "Pick your browser install option.",
        "Finish install in that browser.",
        "Return here and click Check connection."
      ];
    }

    if (selectedInstallTarget === "zip") {
      return [
        "Extract the downloaded ZIP to a folder.",
        `Open ${extensionsManagerUrl} in your browser.`,
        "Turn on Developer mode.",
        "Click Load unpacked and choose the extracted folder.",
        "Return to FocusOS and click Check connection."
      ];
    }

    return [
      `Open the ${selectedInstallTarget} store page and click Add to browser / Get.`,
      "Approve the extension install prompt.",
      "Return to FocusOS and click Check connection."
    ];
  }, [selectedInstallTarget, extensionsManagerUrl]);

  const exportSessions = () => {
    const payload = JSON.stringify(state.sessions, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "focusos-sessions.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const signOut = async () => {
    await logout();
    navigate("/auth");
  };

  return (
    <div className="animate-fade-in mx-auto max-w-content px-8 py-8 space-y-8">
      <h1 className="page-title">Settings</h1>

      <div className="focus-card">
        <div className="section-label mb-4">ACCOUNT</div>
        <p className="text-sm text-muted-foreground">{user?.email || "Not signed in"}</p>
      </div>

      <div className="focus-card">
        <div className="section-label mb-4">PREFERENCES</div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Theme</label>
            <div className="mt-2 flex gap-2">
              {(["light", "dark", "system"] as const).map((entry) => (
                <button
                  key={entry}
                  onClick={() => setTheme(entry)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    theme === entry
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {entry.charAt(0).toUpperCase() + entry.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Timezone</label>
            <div className="mt-2 flex gap-2">
              <select
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {TIMEZONES.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
              <button onClick={() => void saveTimezone()} className="rounded-lg border border-border px-3 py-2 text-sm" disabled={savingTimezone}>
                {savingTimezone ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="focus-card">
        <div className="section-label mb-4">FOCUS EXTENSION</div>
        <p className="text-sm text-foreground">
          Status: <span className={extensionConnected ? "text-[#16A34A]" : "text-muted-foreground"}>{extensionConnected ? "Connected" : "Not connected"}</span>
        </p>

        <p className="mt-2 text-xs text-muted-foreground">
          {runtimeSupported
            ? extensionConfigured
              ? `Install the ${browserLabel} extension once, then FocusOS connects automatically.`
              : "Extension IDs are not configured for this app build yet."
            : "Use Chrome, Edge, or Brave for extension-based site blocking."}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {installTargets.map((target) => (
            <button
              key={target.id}
              onClick={() => installExtension(target.id)}
              className={`rounded-lg px-4 py-2 text-sm hover:opacity-90 ${target.id === "zip" ? "border border-border text-muted-foreground" : "bg-primary font-semibold text-primary-foreground"}`}
              disabled={!runtimeSupported}
            >
              {target.id === "zip" ? "Download ZIP" : `Install for ${target.label}`}
            </button>
          ))}
          <button
            onClick={() => void checkExtensionConnection()}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
            disabled={!runtimeSupported || !extensionConfigured || checkingExtension}
          >
            {checkingExtension ? "Checking..." : "Check connection"}
          </button>
          <button
            onClick={openExtensionsManager}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            disabled={!runtimeSupported}
          >
            Open Extensions Page
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-background/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step-by-step setup</p>
          <div className="mt-2 space-y-1 text-sm text-foreground">
            {setupSteps.map((step, index) => (
              <p key={step}>{index + 1}. {step}</p>
            ))}
          </div>
        </div>

        <details className="mt-4 rounded-lg border border-border bg-background/40 p-3">
          <summary className="cursor-pointer text-xs text-muted-foreground">Developer override</summary>
          <div className="mt-3">
            <label className="text-sm font-medium text-foreground">Extension ID</label>
            <div className="mt-2 flex gap-2">
              <input
                value={extensionId}
                onChange={(event) => setExtensionIdInput(event.target.value)}
                placeholder="Paste extension ID from chrome://extensions"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
              <button onClick={() => void handleExtensionSave()} className="rounded-lg border border-border px-3 py-2 text-sm">Save</button>
            </div>
          </div>
        </details>
      </div>

      <div className="focus-card">
        <div className="section-label mb-4">DATA</div>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportSessions} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Export Data</button>
          <button onClick={signOut} className="rounded-lg border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10">Sign Out</button>
        </div>
      </div>
    </div>
  );
}

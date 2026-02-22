import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useFocus } from "@/context/FocusContext";
import { computePaceMetrics, EMERGENCY_KILL_MARKER, resolveAllowedSites } from "@/lib/analytics";
import { startFocusMode, stopFocusMode } from "@/lib/extensionBridge";
import { StarRating } from "./StarRating";
import type { SessionRecord } from "@/lib/types";

type Step = "setup" | "timer" | "reflection";

interface SessionTimerModalProps {
  goalId: string;
  durationMinutes: number;
  onClose: () => void;
  onComplete: () => void;
}

export function SessionTimerModal({ goalId: initialGoalId, durationMinutes: initialDuration, onClose, onComplete }: SessionTimerModalProps) {
  const { user } = useAuth();
  const { state, dispatch } = useFocus();

  const [step, setStep] = useState<Step>("setup");
  const [selectedGoalId, setSelectedGoalId] = useState(initialGoalId);
  const [durationMinutes, setDurationMinutes] = useState(initialDuration);

  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const sessionStartRef = useRef<string>("");
  const sessionEndRef = useRef<string>("");

  const [focusModeActive, setFocusModeActive] = useState(false);
  const [emergencyKillUsed, setEmergencyKillUsed] = useState(false);

  const [movedForward, setMovedForward] = useState("");
  const [hesitation, setHesitation] = useState("");
  const [nextStart, setNextStart] = useState("");
  const [focusQuality, setFocusQuality] = useState(0);
  const [difficulty, setDifficulty] = useState(0);

  const selectedGoal = state.goals.find((goal) => goal.id === selectedGoalId) || null;
  const allowedSitesPreview = useMemo(
    () => resolveAllowedSites(selectedGoal?.allowedSites ?? { categories: [], customSites: [] }),
    [selectedGoal]
  );

  const beginFocusMode = async () => {
    if (!selectedGoal) {
      return;
    }

    sessionStartRef.current = new Date().toISOString();
    sessionEndRef.current = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    setSecondsRemaining(durationMinutes * 60);
    setEmergencyKillUsed(false);

    const ok = await startFocusMode(allowedSitesPreview, sessionEndRef.current);
    setFocusModeActive(ok);
    setStep("timer");
  };

  useEffect(() => {
    if (step !== "timer") {
      return;
    }

    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(sessionEndRef.current).getTime() - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        window.clearInterval(timer);
        setStep("reflection");
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [step]);

  useEffect(() => {
    return () => {
      void stopFocusMode();
    };
  }, []);

  const totalSeconds = durationMinutes * 60;
  const elapsedSeconds = totalSeconds - secondsRemaining;
  const progressPct = totalSeconds > 0 ? Math.min(100, (elapsedSeconds / totalSeconds) * 100) : 0;

  const saveSession = async () => {
    if (!user || !selectedGoal || !movedForward.trim() || !nextStart.trim()) {
      return;
    }

    const measuredDuration = Math.max(
      1,
      Math.round((Date.now() - new Date(sessionStartRef.current).getTime()) / 60000)
    );

    const hesitationText = hesitation.trim();
    const taggedHesitation = emergencyKillUsed
      ? `${hesitationText} ${EMERGENCY_KILL_MARKER}`.trim()
      : hesitationText;

    const newSession: SessionRecord = {
      id: crypto.randomUUID(),
      userId: user.id,
      goalId: selectedGoal.id,
      startTime: sessionStartRef.current,
      endTime: new Date().toISOString(),
      durationMinutes: Math.min(durationMinutes, measuredDuration),
      focusQuality: focusQuality > 0 ? focusQuality : null,
      difficulty: difficulty > 0 ? difficulty : null,
      movedForward: movedForward.trim(),
      hesitation: taggedHesitation || null,
      nextStart: nextStart.trim(),
      createdAt: new Date().toISOString()
    };

    dispatch({ type: "ADD_SESSION", payload: newSession });

    const updatedSessions = [newSession, ...state.sessions];
    const metrics = computePaceMetrics(selectedGoal, updatedSessions);

    dispatch({
      type: "UPSERT_RISK_SNAPSHOT",
      payload: {
        id: crypto.randomUUID(),
        goalId: selectedGoal.id,
        date: new Date().toISOString().split("T")[0],
        currentWeeklyPace: metrics.currentWeeklyPace,
        requiredWeeklyPace: metrics.requiredPace,
        paceGap: metrics.paceGap,
        projectedHours: metrics.totalLoggedHours + metrics.currentWeeklyPace * metrics.remainingWeeks,
        completionProbability: metrics.completionProbability,
        trajectoryBand: metrics.trajectoryBand,
        createdAt: new Date().toISOString()
      }
    });

    await stopFocusMode();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20" onClick={step === "setup" ? onClose : undefined}>
      <div className="animate-modal-in w-full max-w-xl rounded-xl border border-border bg-card p-6 mx-4 max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-header">
            {step === "setup" ? "Start Focus Session" : step === "timer" ? "Focus Session" : "Session Reflection"}
          </h2>
          {step !== "timer" && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
          )}
        </div>

        {step === "setup" && (
          <div className="space-y-5">
            <div>
              <label className="section-label">Goal</label>
              <select
                value={selectedGoalId}
                onChange={(event) => setSelectedGoalId(event.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                {state.goals.filter((goal) => !goal.archived).map((goal) => (
                  <option key={goal.id} value={goal.id}>{goal.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="section-label">Duration</label>
              <div className="mt-2 flex items-center gap-3">
                <button onClick={() => setDurationMinutes((prev) => Math.max(10, prev - 5))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground">-</button>
                <span className="font-mono-calc text-foreground min-w-[68px] text-center">{durationMinutes} min</span>
                <button onClick={() => setDurationMinutes((prev) => Math.min(120, prev + 5))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground">+</button>
              </div>
            </div>

            <div>
              <p className="section-label mb-2">Allowed Sites Preview</p>
              <div className="flex flex-wrap gap-2">
                {allowedSitesPreview.map((site) => (
                  <span key={site} className="inline-flex items-center rounded-md border border-border bg-accent px-2 py-1 text-xs text-foreground">
                    {site}
                  </span>
                ))}
                {allowedSitesPreview.length === 0 && (
                  <span className="text-xs text-muted-foreground">No allowed sites configured for this goal.</span>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-foreground">
              Before you begin: keep your phone away, silence notifications, and close distracting tabs.
            </div>

            <button onClick={beginFocusMode} className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90" style={{ borderRadius: 8 }}>
              Begin Focus Mode
            </button>
          </div>
        )}

        {step === "timer" && (
          <div className="text-center">
            <div className="timer-digits">{String(Math.floor(secondsRemaining / 60)).padStart(2, "0")}:{String(secondsRemaining % 60).padStart(2, "0")}</div>
            <div className="mx-auto mt-3 h-[3px] w-full overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct}%`, transition: "width 1s linear" }} />
            </div>

            <p className="mt-4 text-sm text-muted-foreground">{selectedGoal?.name}</p>

            <p className="mt-3 text-xs font-medium">
              {focusModeActive ? "🔒 Focus mode active" : "Extension not connected"}
            </p>

            {allowedSitesPreview.length > 0 && (
              <div className="mt-5 text-left">
                <p className="text-xs font-medium text-muted-foreground mb-2">ALLOWED SITES</p>
                <div className="flex flex-wrap gap-2">
                  {allowedSitesPreview.map((site) => (
                    <a
                      key={site}
                      href={`https://${site}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-accent px-2 py-1 text-xs text-foreground"
                    >
                      {site}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setEmergencyKillUsed(true);
                setStep("reflection");
              }}
              className="mt-8 text-sm text-muted-foreground hover:text-foreground"
            >
              Emergency Kill
            </button>
          </div>
        )}

        {step === "reflection" && (
          <div className="space-y-4">
            {emergencyKillUsed && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                Emergency kill was used for this session and will be included in your weekly review.
              </p>
            )}
            <div>
              <label className="text-sm font-medium text-foreground">What moved forward? *</label>
              <textarea value={movedForward} onChange={(event) => setMovedForward(event.target.value)} rows={2} className="mt-1 w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground" />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Where did you hesitate?</label>
              <textarea value={hesitation} onChange={(event) => setHesitation(event.target.value)} rows={2} className="mt-1 w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground" />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Next starting point? *</label>
              <textarea value={nextStart} onChange={(event) => setNextStart(event.target.value)} rows={2} className="mt-1 w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground" />
            </div>

            <div className="flex gap-8">
              <div>
                <label className="text-sm font-medium text-foreground">Focus quality</label>
                <div className="mt-1"><StarRating value={focusQuality} onChange={setFocusQuality} /></div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Difficulty</label>
                <div className="mt-1"><StarRating value={difficulty} onChange={setDifficulty} /></div>
              </div>
            </div>

            <button
              onClick={() => void saveSession()}
              disabled={!movedForward.trim() || !nextStart.trim()}
              className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
              style={{ borderRadius: 8 }}
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

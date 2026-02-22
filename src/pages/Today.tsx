import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useFocus } from "@/context/FocusContext";
import { computePaceMetrics, getSuggestedSession } from "@/lib/analytics";
import { PaceBar } from "@/components/PaceBar";
import { SessionTimerModal } from "@/components/SessionTimerModal";
import { TrajectoryBadge } from "@/components/TrajectoryBadge";
import { StarRating } from "@/components/StarRating";

type ExtraSessionDecision = "pending" | "accepted" | "declined";

const EXTRA_SESSION_KEY = "focusos.extraSessionDecision.v1";

function getWeekStartIso(date: Date): string {
  const copy = new Date(date);
  const day = copy.getDay();
  const shift = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + shift);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

function loadExtraSessionDecision(userId: string, weekStart: string, goalId: string): ExtraSessionDecision {
  if (typeof window === "undefined") {
    return "pending";
  }

  try {
    const raw = window.localStorage.getItem(EXTRA_SESSION_KEY);
    if (!raw) {
      return "pending";
    }

    const parsed = JSON.parse(raw) as {
      userId?: string;
      weekStart?: string;
      goalId?: string;
      decision?: ExtraSessionDecision;
    };

    const valid = parsed.userId === userId
      && parsed.weekStart === weekStart
      && parsed.goalId === goalId
      && (parsed.decision === "accepted" || parsed.decision === "declined");

    return valid ? parsed.decision : "pending";
  } catch {
    return "pending";
  }
}

function saveExtraSessionDecision(userId: string, weekStart: string, goalId: string, decision: Exclude<ExtraSessionDecision, "pending">) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    EXTRA_SESSION_KEY,
    JSON.stringify({ userId, weekStart, goalId, decision, updatedAt: new Date().toISOString() })
  );
}

export default function TodayPage() {
  const { user } = useAuth();
  const { state } = useFocus();
  const [sessionRequest, setSessionRequest] = useState<{ goalId: string; durationMinutes: number } | null>(null);
  const [extraSessionDecision, setExtraSessionDecision] = useState<ExtraSessionDecision>("pending");

  const activeGoals = state.goals.filter((goal) => !goal.archived);

  const metricsByGoal = useMemo(
    () => activeGoals.map((goal) => ({ goal, metrics: computePaceMetrics(goal, state.sessions) })),
    [activeGoals, state.sessions]
  );

  const suggestedSession = useMemo(
    () => getSuggestedSession(activeGoals, state.sessions),
    [activeGoals, state.sessions]
  );

  const strategicGoal = useMemo(
    () => [...metricsByGoal].sort((a, b) => b.metrics.paceGap - a.metrics.paceGap)[0] ?? null,
    [metricsByGoal]
  );

  const lowProbabilityEntry = useMemo(
    () => metricsByGoal
      .filter(({ metrics }) => metrics.remainingHours > 0 && metrics.completionProbability < 0.65)
      .sort((a, b) => a.metrics.completionProbability - b.metrics.completionProbability)[0] ?? null,
    [metricsByGoal]
  );

  const recoveryDuration = lowProbabilityEntry?.metrics.trajectoryBand === "At Risk" ? 45 : 30;

  useEffect(() => {
    if (!user || !lowProbabilityEntry) {
      setExtraSessionDecision("pending");
      return;
    }

    const weekStart = getWeekStartIso(new Date());
    setExtraSessionDecision(loadExtraSessionDecision(user.id, weekStart, lowProbabilityEntry.goal.id));
  }, [user, lowProbabilityEntry]);

  const onChooseExtraSession = (decision: Exclude<ExtraSessionDecision, "pending">) => {
    setExtraSessionDecision(decision);

    if (!user || !lowProbabilityEntry) {
      return;
    }

    const weekStart = getWeekStartIso(new Date());
    saveExtraSessionDecision(user.id, weekStart, lowProbabilityEntry.goal.id, decision);
  };

  const lastSession = useMemo(
    () => [...state.sessions].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0] ?? null,
    [state.sessions]
  );

  const lastSessionGoal = lastSession ? state.goals.find((goal) => goal.id === lastSession.goalId) : null;

  const strategicDaysLeft = strategicGoal
    ? Math.max(0, Math.round(strategicGoal.metrics.remainingWeeks * 7))
    : 0;

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (activeGoals.length === 0) {
    return <Navigate to="/goals" replace />;
  }

  return (
    <div className="animate-fade-in mx-auto max-w-content px-8 py-8 space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">Today</h1>
        <Link to="/goals?create=1" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          + Add Goal
        </Link>
      </div>

      <div className="focus-card">
        <div className="section-label mb-3">STRATEGIC MEMO</div>
        {strategicGoal ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Primary focus</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{strategicGoal.goal.name}</p>
              </div>
              <TrajectoryBadge band={strategicGoal.metrics.trajectoryBand} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Pace gap</p>
                <p className="mt-1 font-mono-calc text-foreground">{Math.max(0, strategicGoal.metrics.paceGap).toFixed(1)} hrs/wk</p>
              </div>
              <div className="rounded-lg border border-border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Required pace</p>
                <p className="mt-1 font-mono-calc text-foreground">{strategicGoal.metrics.requiredPace.toFixed(1)} hrs/wk</p>
              </div>
              <div className="rounded-lg border border-border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Deadline window</p>
                <p className="mt-1 font-mono-calc text-foreground">{strategicDaysLeft} days left</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {strategicGoal.metrics.paceGap > 0
                ? `Protect one extra ${recoveryDuration}-minute block for ${strategicGoal.goal.name} today.`
                : `Hold your current pace and avoid context switches during deep work blocks.`}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active goals yet.</p>
        )}
      </div>

      {lowProbabilityEntry && extraSessionDecision === "pending" && (
        <div className="focus-card border border-amber-400/40 bg-amber-500/10">
          <p className="section-label mb-2">EXTRA SESSION RECOMMENDATION</p>
          <p className="text-sm text-foreground">
            {lowProbabilityEntry.goal.name} is currently off-track.
            Add one extra {recoveryDuration}-minute focus session today to recover pace?
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => onChooseExtraSession("accepted")}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Yes, add it
            </button>
            <button
              onClick={() => onChooseExtraSession("declined")}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              No, skip
            </button>
          </div>
        </div>
      )}

      {lowProbabilityEntry && extraSessionDecision === "accepted" && (
        <div className="focus-card">
          <p className="section-label mb-2">RECOVERY SESSION QUEUED</p>
          <p className="text-sm text-muted-foreground">
            Run one extra {recoveryDuration}-minute block for {lowProbabilityEntry.goal.name} to improve this week&apos;s pacing trend.
          </p>
          <button
            onClick={() => setSessionRequest({ goalId: lowProbabilityEntry.goal.id, durationMinutes: recoveryDuration })}
            className="mt-3 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            style={{ borderRadius: 8 }}
          >
            Start Recovery Session
          </button>
        </div>
      )}

      {suggestedSession && (
        <div className="focus-card">
          <div className="section-label mb-3">SUGGESTED SESSION</div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="card-title">{suggestedSession.goalName}</p>
              <p className="mt-1 font-mono-calc text-muted-foreground">{suggestedSession.durationMinutes} minutes</p>
              <p className="mt-2 text-sm text-muted-foreground">{suggestedSession.reason}</p>
              <p className="mt-2 text-xs text-muted-foreground">Allowed sites: {suggestedSession.allowedSites.length}</p>
            </div>
            <button
              onClick={() => setSessionRequest({ goalId: suggestedSession.goalId, durationMinutes: suggestedSession.durationMinutes })}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              style={{ borderRadius: 8 }}
            >
              Start Focus Session
            </button>
          </div>
        </div>
      )}

      {lastSession && (
        <div className="focus-card">
          <div className="section-label mb-3">LAST REFLECTION</div>
          <p className="card-title">{lastSessionGoal?.name ?? "Unknown goal"}</p>
          <div className="mt-3 space-y-2">
            <div>
              <span className="text-xs text-muted-foreground">Moved forward:</span>
              <p className="text-sm text-foreground">{lastSession.movedForward || "-"}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Next start:</span>
              <p className="text-sm text-foreground">{lastSession.nextStart || "-"}</p>
            </div>
            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Focus:</span>
                <StarRating value={lastSession.focusQuality ?? 0} readonly size={14} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Difficulty:</span>
                <StarRating value={lastSession.difficulty ?? 0} readonly size={14} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="section-label mb-4">GOAL STATUS</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {metricsByGoal.map(({ goal, metrics }) => (
            <Link key={goal.id} to={`/goals/${goal.id}`} className="focus-card block">
              <div className="flex items-start justify-between">
                <p className="card-title">{goal.name}</p>
                <TrajectoryBadge band={metrics.trajectoryBand} size="sm" />
              </div>

              <div className="mt-3 flex items-baseline justify-between text-sm">
                <span className="font-mono-calc">{metrics.currentWeeklyPace.toFixed(1)} / {goal.weeklyTargetHours} hrs</span>
                <span className="font-mono-calc text-muted-foreground">{metrics.requiredPace.toFixed(1)} req</span>
              </div>

              <div className="mt-2">
                <PaceBar
                  current={metrics.currentWeeklyPace}
                  required={metrics.requiredPace}
                  target={goal.weeklyTargetHours}
                  band={metrics.trajectoryBand}
                />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {sessionRequest && (
        <SessionTimerModal
          goalId={sessionRequest.goalId}
          durationMinutes={sessionRequest.durationMinutes}
          onClose={() => setSessionRequest(null)}
          onComplete={() => setSessionRequest(null)}
        />
      )}
    </div>
  );
}

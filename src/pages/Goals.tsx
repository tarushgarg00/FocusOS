import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useFocus } from "@/context/FocusContext";
import { computePaceMetrics } from "@/lib/analytics";
import { TrajectoryBadge } from "@/components/TrajectoryBadge";
import { PaceBar } from "@/components/PaceBar";
import AllowedSitesEditor from "@/components/AllowedSitesEditor";

interface GoalDraft {
  name: string;
  description: string;
  deadline: string;
  totalEstimatedHours: string;
  weeklyTargetHours: string;
  allowedSites: { categories: string[]; customSites: string[] };
}

const EMPTY_DRAFT: GoalDraft = {
  name: "",
  description: "",
  deadline: "",
  totalEstimatedHours: "",
  weeklyTargetHours: "",
  allowedSites: { categories: [], customSites: [] }
};

export default function GoalsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { state, dispatch } = useFocus();
  const [draft, setDraft] = useState<GoalDraft>(EMPTY_DRAFT);
  const [showCreate, setShowCreate] = useState(searchParams.get("create") === "1");

  const activeGoals = state.goals.filter((goal) => !goal.archived);

  const goalCards = useMemo(
    () => activeGoals.map((goal) => ({ goal, metrics: computePaceMetrics(goal, state.sessions) })),
    [activeGoals, state.sessions]
  );

  const createGoal = () => {
    if (!user) {
      return;
    }

    if (!draft.name.trim() || !draft.deadline || !draft.totalEstimatedHours || !draft.weeklyTargetHours) {
      return;
    }

    dispatch({
      type: "UPSERT_GOAL",
      payload: {
        id: crypto.randomUUID(),
        userId: user.id,
        name: draft.name.trim(),
        description: draft.description.trim(),
        deadline: draft.deadline,
        totalEstimatedHours: Number(draft.totalEstimatedHours),
        weeklyTargetHours: Number(draft.weeklyTargetHours),
        archived: false,
        allowedSites: draft.allowedSites,
        createdAt: new Date().toISOString()
      }
    });

    setDraft(EMPTY_DRAFT);
    setShowCreate(false);
    navigate("/today");
  };

  return (
    <div className="animate-fade-in mx-auto max-w-content px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Goals</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          + Add Goal
        </button>
      </div>

      {(showCreate || activeGoals.length === 0) && (
        <div className="focus-card space-y-4">
          <div className="section-label">{activeGoals.length === 0 ? "ONBOARDING" : "NEW GOAL"}</div>

          <div>
            <label className="text-sm font-medium text-foreground">Goal name *</label>
            <input
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Description</label>
            <textarea
              value={draft.description}
              onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-foreground">Deadline *</label>
              <input
                type="date"
                value={draft.deadline}
                onChange={(event) => setDraft((prev) => ({ ...prev, deadline: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Total estimated hours *</label>
              <input
                type="number"
                min={1}
                step={0.5}
                value={draft.totalEstimatedHours}
                onChange={(event) => setDraft((prev) => ({ ...prev, totalEstimatedHours: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Weekly target hours *</label>
              <input
                type="number"
                min={1}
                step={0.5}
                value={draft.weeklyTargetHours}
                onChange={(event) => setDraft((prev) => ({ ...prev, weeklyTargetHours: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Allowed sites</label>
            <div className="mt-2">
              <AllowedSitesEditor
                value={draft.allowedSites}
                onChange={(allowedSites) => setDraft((prev) => ({ ...prev, allowedSites }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={createGoal} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Save Goal
            </button>
            {activeGoals.length > 0 && (
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {goalCards.map(({ goal, metrics }) => {
          const daysRemaining = Math.max(0, Math.round(metrics.remainingWeeks * 7));

          return (
            <Link key={goal.id} to={`/goals/${goal.id}`} className="focus-card block">
              <div className="flex items-start justify-between">
                <div>
                  <p className="card-title">{goal.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Due {new Date(goal.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {daysRemaining} days remaining
                  </p>
                </div>
                <TrajectoryBadge band={metrics.trajectoryBand} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <span className="section-label">Current pace</span>
                  <p className="mt-1 font-mono-calc text-foreground">{metrics.currentWeeklyPace.toFixed(1)} hrs/wk</p>
                </div>
                <div>
                  <span className="section-label">Required</span>
                  <p className="mt-1 font-mono-calc text-foreground">{metrics.requiredPace.toFixed(1)} hrs/wk</p>
                </div>
                <div>
                  <span className="section-label">Remaining</span>
                  <p className="mt-1 font-mono-calc text-foreground">{metrics.remainingHours.toFixed(1)} hrs</p>
                </div>
                <div>
                  <span className="section-label">Logged</span>
                  <p className="mt-1 font-mono-calc text-foreground">{metrics.totalLoggedHours.toFixed(1)} hrs</p>
                </div>
              </div>

              <div className="mt-3">
                <PaceBar
                  current={metrics.currentWeeklyPace}
                  required={metrics.requiredPace}
                  target={goal.weeklyTargetHours}
                  band={metrics.trajectoryBand}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

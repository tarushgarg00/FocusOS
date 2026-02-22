import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFocus } from "@/context/FocusContext";
import { computePaceMetrics, isEmergencyKillSession, stripEmergencyKillMarker } from "@/lib/analytics";
import { StarRating } from "@/components/StarRating";
import { TrajectoryBadge } from "@/components/TrajectoryBadge";
import AllowedSitesEditor from "@/components/AllowedSitesEditor";

export default function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, dispatch } = useFocus();
  const [whatIfDelta, setWhatIfDelta] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editTotalHours, setEditTotalHours] = useState("");
  const [editWeeklyHours, setEditWeeklyHours] = useState("");
  const [editAllowedSites, setEditAllowedSites] = useState<{ categories: string[]; customSites: string[] }>({ categories: [], customSites: [] });

  const goal = state.goals.find((entry) => entry.id === id);
  if (!goal) {
    return <div className="mx-auto max-w-content px-8 py-8"><p>Goal not found.</p></div>;
  }

  const metrics = computePaceMetrics(goal, state.sessions);
  const goalSessions = [...state.sessions]
    .filter((session) => session.goalId === goal.id)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const projectedGap = metrics.paceGap - whatIfDelta;

  const riskTrend = useMemo(
    () => state.riskSnapshots
      .filter((snapshot) => snapshot.goalId === goal.id)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((snapshot) => ({
        date: new Date(snapshot.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        probability: Math.round(snapshot.completionProbability * 100)
      })),
    [state.riskSnapshots, goal.id]
  );

  const beginEdit = () => {
    setEditName(goal.name);
    setEditDescription(goal.description || "");
    setEditDeadline(goal.deadline);
    setEditTotalHours(String(goal.totalEstimatedHours));
    setEditWeeklyHours(String(goal.weeklyTargetHours));
    setEditAllowedSites(goal.allowedSites);
    setEditing(true);
  };

  const saveGoal = () => {
    if (!editName.trim() || !editDeadline || !editTotalHours || !editWeeklyHours) {
      return;
    }

    dispatch({
      type: "UPSERT_GOAL",
      payload: {
        ...goal,
        name: editName.trim(),
        description: editDescription.trim(),
        deadline: editDeadline,
        totalEstimatedHours: Number(editTotalHours),
        weeklyTargetHours: Number(editWeeklyHours),
        allowedSites: editAllowedSites
      }
    });
    setEditing(false);
  };

  return (
    <div className="animate-fade-in mx-auto max-w-content px-8 py-8 space-y-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/goals" className="hover:text-foreground">Goals</Link>
        <span>/</span>
        <span className="text-foreground">{goal.name}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <h1 className="page-title">{goal.name}</h1>
        <TrajectoryBadge band={metrics.trajectoryBand} />
      </div>

      <div className="focus-card">
        <div className="section-label mb-4">PACE METRICS</div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div><span className="text-xs text-muted-foreground">Current pace</span><p className="font-mono-calc">{metrics.currentWeeklyPace.toFixed(2)} hrs/wk</p></div>
          <div><span className="text-xs text-muted-foreground">Total logged</span><p className="font-mono-calc">{metrics.totalLoggedHours.toFixed(2)} hrs</p></div>
          <div><span className="text-xs text-muted-foreground">Remaining</span><p className="font-mono-calc">{metrics.remainingHours.toFixed(2)} hrs</p></div>
          <div><span className="text-xs text-muted-foreground">Weeks left</span><p className="font-mono-calc">{metrics.remainingWeeks.toFixed(2)}</p></div>
          <div><span className="text-xs text-muted-foreground">Required pace</span><p className="font-mono-calc">{metrics.requiredPace.toFixed(2)} hrs/wk</p></div>
          <div><span className="text-xs text-muted-foreground">Pace gap</span><p className="font-mono-calc">{metrics.paceGap.toFixed(2)} hrs/wk</p></div>
          <div><span className="text-xs text-muted-foreground">Deadline</span><p className="font-mono-calc">{new Date(goal.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p></div>
          <div><span className="text-xs text-muted-foreground">Band</span><p className="font-mono-calc">{metrics.trajectoryBand}</p></div>
        </div>
      </div>

      <div className="focus-card">
        <div className="section-label mb-3">WHAT-IF ANALYSIS</div>
        <input
          type="range"
          min={0}
          max={5}
          step={0.5}
          value={whatIfDelta}
          onChange={(event) => setWhatIfDelta(Number(event.target.value))}
          className="w-full accent-primary"
        />
        <p className="mt-2 text-sm font-mono-calc">
          +{whatIfDelta.toFixed(1)} hrs/wk {"->"} {projectedGap > 0 ? `${projectedGap.toFixed(1)} hrs/wk behind` : `${Math.abs(projectedGap).toFixed(1)} hrs/wk ahead`}
        </p>
      </div>

      <div className="focus-card">
        <div className="flex items-center justify-between mb-3">
          <div className="section-label">ALLOWED SITES</div>
          <button onClick={() => (editing ? setEditing(false) : beginEdit())} className="text-sm text-primary hover:underline">{editing ? "Close" : "Edit"}</button>
        </div>
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground">Goal name</label>
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-foreground">Deadline</label>
                <input
                  type="date"
                  value={editDeadline}
                  onChange={(event) => setEditDeadline(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Weekly target hours</label>
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  value={editWeeklyHours}
                  onChange={(event) => setEditWeeklyHours(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Total estimated hours</label>
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  value={editTotalHours}
                  onChange={(event) => setEditTotalHours(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Description</label>
              <textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <AllowedSitesEditor
              value={editAllowedSites}
              onChange={setEditAllowedSites}
            />
            <button onClick={saveGoal} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save</button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Categories: {goal.allowedSites.categories.join(", ") || "None"}</p>
            <p className="text-xs text-muted-foreground">Custom: {goal.allowedSites.customSites.join(", ") || "None"}</p>
          </div>
        )}
      </div>

      {riskTrend.length > 1 && (
        <div className="focus-card">
          <div className="section-label mb-4">RISK TREND</div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={riskTrend}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="probability" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="focus-card">
        <div className="section-label mb-4">SESSION HISTORY</div>
        {goalSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        ) : (
          <div className="space-y-4">
            {goalSessions.slice(0, 20).map((session) => (
              <div key={session.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">{new Date(session.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  <span className="font-mono-calc text-sm text-muted-foreground">{session.durationMinutes} min</span>
                </div>
                <div className="mt-1 flex items-center gap-4">
                  <StarRating value={session.focusQuality ?? 0} readonly size={12} />
                  <span className="text-xs text-muted-foreground">Difficulty {session.difficulty ?? 0}/5</span>
                </div>
                <p className="mt-1 text-sm text-foreground">{session.movedForward || ""}</p>
                {isEmergencyKillSession(session) && (
                  <p className="mt-1 inline-flex rounded border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Emergency Kill</p>
                )}
                {session.hesitation && (
                  <p className="mt-1 text-xs text-muted-foreground">Hesitation: {stripEmergencyKillMarker(session.hesitation)}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">Next: {session.nextStart || ""}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => dispatch({ type: "UPSERT_GOAL", payload: { ...goal, archived: true } })}
          className="rounded-lg border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
        >
          Archive goal
        </button>
      </div>
    </div>
  );
}

import { Fragment, useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFocus } from "@/context/FocusContext";
import { computeEnergyScores, getEnergyInsight, isEmergencyKillSession } from "@/lib/analytics";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, index) => index);

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}${suffix}`;
}

export default function PatternsPage() {
  const { state } = useFocus();

  const energyScores = useMemo(() => computeEnergyScores(state.sessions), [state.sessions]);
  const insightText = useMemo(() => getEnergyInsight(energyScores), [energyScores]);

  const recentSessions = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return state.sessions.filter((session) => new Date(session.startTime) >= cutoff);
  }, [state.sessions]);

  const insightMetrics = useMemo(() => {
    if (recentSessions.length === 0) {
      return null;
    }

    const totalMinutes = recentSessions.reduce((sum, session) => sum + session.durationMinutes, 0);
    const deepMinutes = recentSessions
      .filter((session) => session.durationMinutes >= 45)
      .reduce((sum, session) => sum + session.durationMinutes, 0);

    const emergencyCount = recentSessions.filter((session) => isEmergencyKillSession(session)).length;
    const emergencyRate = recentSessions.length > 0 ? Math.round((emergencyCount / recentSessions.length) * 100) : 0;

    const activeDayStamps = [...new Set(recentSessions.map((session) => {
      const started = new Date(session.startTime);
      return new Date(started.getFullYear(), started.getMonth(), started.getDate()).getTime();
    }))].sort((a, b) => a - b);

    let longestStreak = 0;
    let runningStreak = 0;
    let previousStamp: number | null = null;

    for (const stamp of activeDayStamps) {
      if (previousStamp == null || stamp - previousStamp === 86400000) {
        runningStreak += 1;
      } else {
        runningStreak = 1;
      }
      longestStreak = Math.max(longestStreak, runningStreak);
      previousStamp = stamp;
    }

    const dayBuckets: { total: number; count: number }[] = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
    const durationBuckets: Record<string, { total: number; count: number; label: string }> = {
      sprint: { total: 0, count: 0, label: "Sprint (under 25m)" },
      standard: { total: 0, count: 0, label: "Standard (25-44m)" },
      deep: { total: 0, count: 0, label: "Deep (45m+)" }
    };

    for (const session of recentSessions) {
      if (session.focusQuality == null) {
        continue;
      }

      const started = new Date(session.startTime);
      const dayIndex = (started.getDay() + 6) % 7;
      const weightedQuality = session.focusQuality * Math.min(1, session.durationMinutes / 25);
      dayBuckets[dayIndex].total += weightedQuality;
      dayBuckets[dayIndex].count += 1;

      if (session.durationMinutes < 25) {
        durationBuckets.sprint.total += session.focusQuality;
        durationBuckets.sprint.count += 1;
      } else if (session.durationMinutes < 45) {
        durationBuckets.standard.total += session.focusQuality;
        durationBuckets.standard.count += 1;
      } else {
        durationBuckets.deep.total += session.focusQuality;
        durationBuckets.deep.count += 1;
      }
    }

    const bestDayIndex = dayBuckets
      .map((bucket, index) => ({ index, average: bucket.count > 0 ? bucket.total / bucket.count : 0, count: bucket.count }))
      .filter((bucket) => bucket.count > 0)
      .sort((a, b) => b.average - a.average)[0]?.index ?? null;

    const bestDurationBand = Object.values(durationBuckets)
      .map((bucket) => ({ ...bucket, average: bucket.count > 0 ? bucket.total / bucket.count : 0 }))
      .filter((bucket) => bucket.count > 0)
      .sort((a, b) => {
        if (b.average !== a.average) {
          return b.average - a.average;
        }
        return b.count - a.count;
      })[0] ?? null;

    return {
      activeDays: activeDayStamps.length,
      longestStreak,
      deepWorkPct: totalMinutes > 0 ? Math.round((deepMinutes / totalMinutes) * 100) : 0,
      emergencyCount,
      emergencyRate,
      bestDayIndex,
      bestDurationBand
    };
  }, [recentSessions]);

  const extraInsights = useMemo(() => {
    if (!insightMetrics) {
      return [];
    }

    const lines: string[] = [];

    if (insightMetrics.bestDayIndex != null) {
      lines.push(`Your strongest day is ${DAYS[insightMetrics.bestDayIndex]}. Reserve your hardest work for that day.`);
    }

    if (insightMetrics.bestDurationBand) {
      lines.push(`${insightMetrics.bestDurationBand.label} sessions currently produce your best focus scores.`);
    }

    if (insightMetrics.emergencyCount > 0) {
      lines.push(`Emergency Kill triggered ${insightMetrics.emergencyCount} times in 30 days (${insightMetrics.emergencyRate}% of sessions).`);
    } else {
      lines.push("No Emergency Kill usage in the past 30 days - your session consistency is strong.");
    }

    if (insightMetrics.longestStreak >= 4) {
      lines.push(`Your longest streak is ${insightMetrics.longestStreak} days. Protect this cadence.`);
    } else {
      lines.push(`Your longest streak is ${insightMetrics.longestStreak} days. Aim for a 4-day streak this week.`);
    }

    return lines.slice(0, 4);
  }, [insightMetrics]);

  const heatmapData = useMemo(() => {
    const buckets: Record<string, { total: number; count: number }> = {};
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const session of state.sessions) {
      if (session.focusQuality == null || new Date(session.startTime) < cutoff) {
        continue;
      }

      const started = new Date(session.startTime);
      const day = (started.getDay() + 6) % 7;
      const hour = started.getHours();
      const key = `${day}-${hour}`;
      if (!buckets[key]) {
        buckets[key] = { total: 0, count: 0 };
      }
      buckets[key].total += session.focusQuality * Math.min(1, session.durationMinutes / 25);
      buckets[key].count += 1;
    }

    return buckets;
  }, [state.sessions]);

  const weeklyFocusTrend = useMemo(() => {
    const rows: { label: string; avg: number }[] = [];

    for (let i = 7; i >= 0; i -= 1) {
      const start = new Date();
      start.setDate(start.getDate() - i * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

      const weekSessions = state.sessions.filter((session) => {
        const started = new Date(session.startTime);
        return started >= start && started < end && session.focusQuality != null;
      });

      const avg = weekSessions.length > 0
        ? Math.round((weekSessions.reduce((sum, session) => sum + (session.focusQuality || 0), 0) / weekSessions.length) * 10) / 10
        : 0;

      rows.push({
        label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        avg
      });
    }

    return rows;
  }, [state.sessions]);

  const getHeatColor = (score: number): string => {
    if (score === 0) return "hsl(var(--background))";
    if (score < 2) return "#E0E7FF";
    if (score < 3.5) return "#818CF8";
    return "#16A34A";
  };

  if (state.sessions.length < 5) {
    return (
      <div className="mx-auto max-w-content px-8 py-8">
        <h1 className="page-title mb-6">Patterns</h1>
        <div className="focus-card text-center py-12">
          <p className="text-sm text-muted-foreground">Log at least 5 sessions to unlock pattern analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in mx-auto max-w-content px-8 py-8 space-y-8">
      <h1 className="page-title">Patterns</h1>

      <div className="focus-card">
        <div className="section-label mb-4">ENERGY HEATMAP</div>
        <div className="overflow-x-auto">
          <div className="grid gap-1" style={{ gridTemplateColumns: "72px repeat(7, 1fr)", minWidth: 520 }}>
            <div />
            {DAYS.map((day) => <div key={day} className="text-center text-xs text-muted-foreground">{day}</div>)}
            {HOURS.map((hour) => (
              <Fragment key={`row-${hour}`}>
                <div key={`label-${hour}`} className="text-right text-xs text-muted-foreground pr-2 leading-6">{hourLabel(hour)}</div>
                {Array.from({ length: 7 }, (_, day) => {
                  const key = `${day}-${hour}`;
                  const entry = heatmapData[key];
                  const score = entry ? entry.total / entry.count : 0;
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className="h-6 rounded-sm border border-border/50"
                      style={{ backgroundColor: getHeatColor(score) }}
                      title={entry ? `${DAYS[day]} ${hourLabel(hour)} — avg ${score.toFixed(1)} (${entry.count} sessions)` : `${DAYS[day]} ${hourLabel(hour)} — no data`}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-border" style={{ backgroundColor: "hsl(var(--background))" }} />No data</div>
          <div className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-border" style={{ backgroundColor: "#E0E7FF" }} />Low focus</div>
          <div className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-border" style={{ backgroundColor: "#818CF8" }} />Medium focus</div>
          <div className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-border" style={{ backgroundColor: "#16A34A" }} />High focus</div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{insightText}</p>
      </div>

      <div className="focus-card">
        <div className="section-label mb-4">INSIGHT SNAPSHOT (LAST 30 DAYS)</div>
        {insightMetrics ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Active days</p>
                <p className="mt-1 font-mono-calc text-foreground">{insightMetrics.activeDays}/30</p>
              </div>
              <div className="rounded-lg border border-border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Longest streak</p>
                <p className="mt-1 font-mono-calc text-foreground">{insightMetrics.longestStreak} days</p>
              </div>
              <div className="rounded-lg border border-border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Deep work share</p>
                <p className="mt-1 font-mono-calc text-foreground">{insightMetrics.deepWorkPct}%</p>
              </div>
              <div className="rounded-lg border border-border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Emergency kills</p>
                <p className="mt-1 font-mono-calc text-foreground">{insightMetrics.emergencyCount}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground">USEFUL OBSERVATIONS</p>
              {extraInsights.map((line) => (
                <p key={line} className="text-sm text-foreground">- {line}</p>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Not enough data to compute 30-day insights yet.</p>
        )}
      </div>

      <div className="focus-card">
        <div className="section-label mb-4">FOCUS QUALITY TREND</div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyFocusTrend}>
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#78716C" }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 12, fill: "#78716C" }} />
              <Tooltip />
              <Line type="monotone" dataKey="avg" stroke="#6366F1" strokeWidth={2} dot={{ r: 3, fill: "#6366F1" }} name="Avg Focus" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

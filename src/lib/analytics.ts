export interface GoalData {
  id: string;
  name: string;
  deadline: string;
  totalEstimatedHours: number;
  weeklyTargetHours: number;
  archived: boolean;
  allowedSites: { categories: string[]; customSites: string[] };
}

export interface SessionData {
  id: string;
  goalId: string;
  startTime: string;
  durationMinutes: number;
  focusQuality: number | null;
  difficulty: number | null;
  movedForward: string | null;
  hesitation: string | null;
  nextStart: string | null;
}

export type TrajectoryBand = "Stable" | "Fragile" | "At Risk";

export interface PaceMetrics {
  currentWeeklyPace: number;
  totalLoggedHours: number;
  remainingHours: number;
  remainingWeeks: number;
  requiredPace: number;
  paceGap: number;
  completionProbability: number;
  trajectoryBand: TrajectoryBand;
}

export interface SuggestedSession {
  goalId: string;
  goalName: string;
  durationMinutes: number;
  reason: string;
  urgencyScore: number;
  allowedSites: string[];
}

export interface EnergyScore {
  hour: number;
  averageScore: number;
  sessionCount: number;
}

export interface WeeklyReviewData {
  weekStart: string;
  totalSessions: number;
  totalHours: number;
  averageFocusQuality: number;
  emergencyKillCount: number;
  goalSummaries: {
    goalId: string;
    goalName: string;
    hoursThisWeek: number;
    targetHours: number;
    paceGap: number;
    trajectoryBand: TrajectoryBand;
    completionProbability: number;
  }[];
  recommendations: string[];
  memoText: string;
}

export const EMERGENCY_KILL_MARKER = "[EMERGENCY_KILL]";

export const SITE_CATEGORIES: Record<string, { label: string; emoji: string; sites: string[] }> = {
  research: {
    label: "Research",
    emoji: "📚",
    sites: ["scholar.google.com", "arxiv.org", "jstor.org", "pubmed.ncbi.nlm.nih.gov", "semanticscholar.org"]
  },
  development: {
    label: "Development",
    emoji: "💻",
    sites: ["github.com", "gitlab.com", "stackoverflow.com", "developer.mozilla.org", "npmjs.com", "devdocs.io"]
  },
  documentation: {
    label: "Documentation",
    emoji: "📝",
    sites: ["docs.google.com", "notion.so", "overleaf.com", "grammarly.com"]
  },
  design: {
    label: "Design",
    emoji: "🎨",
    sites: ["figma.com", "canva.com", "dribbble.com", "coolors.co", "unsplash.com"]
  },
  data: {
    label: "Data & Analysis",
    emoji: "📊",
    sites: ["colab.research.google.com", "kaggle.com", "wolframalpha.com", "desmos.com"]
  },
  learning: {
    label: "Learning",
    emoji: "🎥",
    sites: ["youtube.com", "coursera.org", "edx.org", "khanacademy.org", "udemy.com"]
  },
  communication: {
    label: "Communication",
    emoji: "💬",
    sites: ["slack.com", "discord.com", "mail.google.com", "teams.microsoft.com"]
  }
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function normalizeDomain(site: string): string {
  const trimmed = site.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  const noProtocol = trimmed.replace(/^https?:\/\//, "");
  const noPath = noProtocol.split("/")[0] ?? "";
  return noPath.replace(/^www\./, "");
}

export function mapGoalRow(row: any): GoalData {
  return {
    id: row.id,
    name: row.name,
    deadline: row.deadline,
    totalEstimatedHours: Number(row.total_estimated_hours),
    weeklyTargetHours: Number(row.weekly_target_hours),
    archived: row.archived || false,
    allowedSites: row.allowed_sites || { categories: [], customSites: [] }
  };
}

export function mapSessionRow(row: any): SessionData {
  return {
    id: row.id,
    goalId: row.goal_id,
    startTime: row.start_time,
    durationMinutes: Number(row.duration_minutes),
    focusQuality: row.focus_quality,
    difficulty: row.difficulty,
    movedForward: row.moved_forward,
    hesitation: row.hesitation,
    nextStart: row.next_start
  };
}

export function isEmergencyKillSession(session: SessionData): boolean {
  return (session.hesitation || "").includes(EMERGENCY_KILL_MARKER);
}

export function stripEmergencyKillMarker(value: string | null): string | null {
  if (!value) {
    return value;
  }
  return value.replace(EMERGENCY_KILL_MARKER, "").trim();
}

export function parseDateSafe(iso: string): Date {
  const datePart = iso.includes("T") ? iso.split("T")[0] : iso;
  const [yearRaw, monthRaw, dayRaw] = datePart.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
    return new Date(year, month - 1, day);
  }

  const fallback = new Date(iso);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  return new Date();
}

export function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export function resolveAllowedSites(config: { categories: string[]; customSites: string[] }): string[] {
  const categorySites = (config.categories || []).flatMap((category) => {
    const normalizedCategory = String(category).toLowerCase();
    return SITE_CATEGORIES[normalizedCategory]?.sites ?? [];
  });

  const merged = [...categorySites, ...(config.customSites || [])]
    .map((site) => normalizeDomain(site))
    .filter(Boolean);

  return [...new Set(merged)];
}

export function computePaceMetrics(goal: GoalData, allSessions: SessionData[]): PaceMetrics {
  const today = toDayStart(new Date());
  const deadline = parseDateSafe(goal.deadline);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const goalSessions = allSessions.filter((session) => session.goalId === goal.id);

  const currentWeeklyPaceRaw = goalSessions
    .filter((session) => {
      const sessionDate = new Date(session.startTime);
      return sessionDate >= weekAgo;
    })
    .reduce((sum, session) => sum + session.durationMinutes, 0) / 60;

  const totalLoggedHoursRaw = goalSessions.reduce((sum, session) => sum + session.durationMinutes, 0) / 60;
  const remainingHoursRaw = Math.max(0, goal.totalEstimatedHours - totalLoggedHoursRaw);
  const remainingWeeksRaw = Math.max(0.1, daysBetween(today, deadline) / 7);
  const requiredPaceRaw = remainingHoursRaw / remainingWeeksRaw;
  const paceGapRaw = requiredPaceRaw - currentWeeklyPaceRaw;

  const completionProbabilityRaw = remainingHoursRaw <= 0
    ? 1
    : clamp((currentWeeklyPaceRaw * remainingWeeksRaw) / remainingHoursRaw, 0, 1);

  const trajectoryBand: TrajectoryBand = paceGapRaw <= 0
    ? "Stable"
    : paceGapRaw <= 1.5
      ? "Fragile"
      : "At Risk";

  return {
    currentWeeklyPace: round2(currentWeeklyPaceRaw),
    totalLoggedHours: round2(totalLoggedHoursRaw),
    remainingHours: round2(remainingHoursRaw),
    remainingWeeks: round2(remainingWeeksRaw),
    requiredPace: round2(requiredPaceRaw),
    paceGap: round2(paceGapRaw),
    completionProbability: round2(completionProbabilityRaw),
    trajectoryBand
  };
}

export function getSuggestedSession(goals: GoalData[], sessions: SessionData[]): SuggestedSession | null {
  const activeGoals = goals.filter((goal) => !goal.archived);
  if (activeGoals.length === 0) {
    return null;
  }

  const goalMetrics = activeGoals.map((goal) => {
    const metrics = computePaceMetrics(goal, sessions);
    const daysToDeadline = Math.max(1, daysBetween(toDayStart(new Date()), parseDateSafe(goal.deadline)));
    const urgencyScore = (Math.max(0, metrics.paceGap) / Math.max(1, metrics.requiredPace)) * (1 / Math.max(1, daysToDeadline));
    return { goal, metrics, daysToDeadline, urgencyScore };
  });

  const hasOpenWork = goalMetrics.some((entry) => entry.metrics.remainingHours > 0);
  if (!hasOpenWork) {
    return null;
  }

  const selected = goalMetrics
    .sort((a, b) => {
      if (b.urgencyScore !== a.urgencyScore) {
        return b.urgencyScore - a.urgencyScore;
      }
      return a.daysToDeadline - b.daysToDeadline;
    })[0];

  if (!selected) {
    return null;
  }

  const durationMinutes = selected.metrics.trajectoryBand === "Stable"
    ? 25
    : selected.metrics.trajectoryBand === "Fragile"
      ? 35
      : 45;

  return {
    goalId: selected.goal.id,
    goalName: selected.goal.name,
    durationMinutes,
    reason: `${selected.goal.name} is ${round2(Math.max(0, selected.metrics.paceGap))} hours behind pace with ${selected.daysToDeadline} days remaining.`,
    urgencyScore: round2(selected.urgencyScore),
    allowedSites: resolveAllowedSites(selected.goal.allowedSites)
  };
}

export function computeEnergyScores(sessions: SessionData[], lookbackDays = 30): EnergyScore[] {
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const buckets: { total: number; count: number }[] = Array.from({ length: 24 }, () => ({ total: 0, count: 0 }));

  for (const session of sessions) {
    const start = new Date(session.startTime);
    if (start < cutoff || session.focusQuality == null) {
      continue;
    }

    const hour = start.getHours();
    const score = session.focusQuality * Math.min(1, session.durationMinutes / 25);
    buckets[hour].total += score;
    buckets[hour].count += 1;
  }

  return buckets.map((bucket, hour) => ({
    hour,
    averageScore: bucket.count > 0 ? round2(bucket.total / bucket.count) : 0,
    sessionCount: bucket.count
  }));
}

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}${suffix}`;
}

export function getEnergyInsight(scores: EnergyScore[]): string {
  const ranked = scores
    .filter((score) => score.sessionCount > 0)
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 3);

  if (ranked.length < 2) {
    return "Log more sessions to discover your peak focus hours.";
  }

  const hours = ranked.map((score) => score.hour).sort((a, b) => a - b);
  const startHour = hours[0];
  const endHour = hours[hours.length - 1] + 1;

  return `Your peak focus hours are ${formatHour(startHour)}-${formatHour(endHour)}. Schedule demanding sessions in this window.`;
}

export function generateStrategicMemo(goals: GoalData[], sessions: SessionData[]): string {
  const activeGoals = goals.filter((goal) => !goal.archived);
  if (activeGoals.length === 0) {
    return "Set up your first goal to get started.";
  }

  const summaries = activeGoals
    .map((goal) => {
      const metrics = computePaceMetrics(goal, sessions);
      const daysToDeadline = Math.max(0, daysBetween(toDayStart(new Date()), parseDateSafe(goal.deadline)));
      return { goal, metrics, daysToDeadline };
    })
    .sort((a, b) => b.metrics.paceGap - a.metrics.paceGap);

  const urgent = summaries[0];
  const others = summaries.slice(1).map((entry) => `${entry.goal.name} is ${entry.metrics.trajectoryBand}`);

  return `You have ${activeGoals.length} active goals. ${urgent.goal.name} is ${urgent.metrics.trajectoryBand} — you're ${round2(Math.max(0, urgent.metrics.paceGap))} hours behind pace with ${urgent.daysToDeadline} days until deadline.${others.length > 0 ? ` ${others.join(". ")}.` : ""}`;
}

export function buildWeeklyReview(
  goals: GoalData[],
  sessions: SessionData[],
  previousSnapshots: any[],
  weekStartDate: Date
): WeeklyReviewData {
  const weekStart = toDayStart(weekStartDate);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const weekSessions = sessions.filter((session) => {
    const start = new Date(session.startTime);
    return start >= weekStart && start < weekEnd;
  });

  const totalSessions = weekSessions.length;
  const totalHours = round2(weekSessions.reduce((sum, session) => sum + session.durationMinutes, 0) / 60);

  const qualityValues = weekSessions
    .map((session) => session.focusQuality)
    .filter((value): value is number => value != null);
  const averageFocusQuality = qualityValues.length > 0
    ? round2(qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length)
    : 0;

  const emergencyKillCount = weekSessions.filter((session) => isEmergencyKillSession(session)).length;

  const activeGoals = goals.filter((goal) => !goal.archived);

  const goalSummaries = activeGoals.map((goal) => {
    const metrics = computePaceMetrics(goal, sessions);
    const hoursThisWeek = round2(
      weekSessions
        .filter((session) => session.goalId === goal.id)
        .reduce((sum, session) => sum + session.durationMinutes, 0) / 60
    );

    return {
      goalId: goal.id,
      goalName: goal.name,
      hoursThisWeek,
      targetHours: round2(goal.weeklyTargetHours),
      paceGap: round2(metrics.paceGap),
      trajectoryBand: metrics.trajectoryBand,
      completionProbability: round2(metrics.completionProbability)
    };
  });

  const mostAtRisk = [...goalSummaries]
    .filter((summary) => summary.trajectoryBand === "At Risk")
    .sort((a, b) => b.paceGap - a.paceGap)[0]
    ?? [...goalSummaries].sort((a, b) => b.paceGap - a.paceGap)[0]
    ?? null;

  const recommendations: string[] = [];
  if (mostAtRisk && mostAtRisk.paceGap > 0) {
    recommendations.push(`Increase ${mostAtRisk.goalName} by ${round2(Math.max(0, mostAtRisk.paceGap))} hours this week to get back on track.`);
  } else {
    recommendations.push("Keep your current pacing and protect your best focus blocks.");
  }
  if (emergencyKillCount > 2) {
    recommendations.push("Emergency kills were frequent this week; reduce interruptions and shorten initial session length to rebuild consistency.");
  }

  const dateRange = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(weekEnd.getTime() - 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  let memoText = `## Weekly Review — ${dateRange}\n\n`;
  memoText += `**Summary:** ${totalSessions} sessions · ${totalHours} hours · avg focus ${averageFocusQuality}/5\n`;
  memoText += `**Emergency Kills:** ${emergencyKillCount}\n\n`;

  for (const summary of goalSummaries) {
    const probPct = Math.round(summary.completionProbability * 100);
    memoText += `**${summary.goalName}:** ${summary.hoursThisWeek}/${summary.targetHours} hrs · ${summary.trajectoryBand}\n`;
    memoText += `${summary.paceGap > 0 ? `Behind pace by ${summary.paceGap} hrs.` : "On pace."} Probability: ${probPct}%.\n`;
    memoText += "\n";
  }

  memoText += "**Recommendations:**\n";
  for (const recommendation of recommendations) {
    memoText += `- ${recommendation}\n`;
  }

  void previousSnapshots;

  return {
    weekStart: weekStart.toISOString(),
    totalSessions,
    totalHours,
    averageFocusQuality,
    emergencyKillCount,
    goalSummaries,
    recommendations,
    memoText
  };
}

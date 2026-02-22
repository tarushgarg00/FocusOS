import type {
  EnergyScore,
  GoalData,
  PaceMetrics,
  SessionData,
  SuggestedSession,
  TrajectoryBand,
  WeeklyReviewData
} from "@/lib/analytics";

export type {
  EnergyScore,
  GoalData,
  PaceMetrics,
  SessionData,
  SuggestedSession,
  TrajectoryBand,
  WeeklyReviewData
};

export interface GoalRecord extends GoalData {
  userId: string;
  description: string;
  createdAt?: string;
}

export interface SessionRecord extends SessionData {
  userId: string;
  endTime: string | null;
  createdAt?: string;
}

export interface RiskSnapshot {
  id: string;
  goalId: string;
  date: string;
  currentWeeklyPace: number;
  requiredWeeklyPace: number;
  paceGap: number;
  projectedHours: number;
  completionProbability: number;
  trajectoryBand: TrajectoryBand;
  createdAt?: string;
}

export interface WeeklyReviewRecord {
  id: string;
  userId: string;
  weekStart: string;
  memo: string;
  statsJson: Record<string, unknown> | null;
  createdAt: string;
}

export interface ProfileRecord {
  id: string;
  name: string;
  timezone: string;
  weekStartDay: number;
}

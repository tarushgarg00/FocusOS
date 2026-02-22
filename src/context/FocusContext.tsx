import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import { mapGoalRow, mapSessionRow } from "@/lib/analytics";
import { GoalRecord, RiskSnapshot, SessionRecord } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export interface AppState {
  goals: GoalRecord[];
  sessions: SessionRecord[];
  riskSnapshots: RiskSnapshot[];
  initialized: boolean;
}

type Action =
  | { type: "LOAD_STATE"; payload: Partial<AppState> }
  | { type: "UPSERT_GOAL"; payload: GoalRecord }
  | { type: "ADD_SESSION"; payload: SessionRecord }
  | { type: "UPSERT_RISK_SNAPSHOT"; payload: RiskSnapshot }
  | { type: "RESET_ALL" };

const initialState: AppState = {
  goals: [],
  sessions: [],
  riskSnapshots: [],
  initialized: false
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOAD_STATE":
      return { ...state, ...action.payload, initialized: true };
    case "UPSERT_GOAL": {
      const index = state.goals.findIndex((goal) => goal.id === action.payload.id);
      if (index >= 0) {
        const next = [...state.goals];
        next[index] = action.payload;
        return { ...state, goals: next };
      }
      return { ...state, goals: [action.payload, ...state.goals] };
    }
    case "ADD_SESSION":
      return { ...state, sessions: [action.payload, ...state.sessions] };
    case "UPSERT_RISK_SNAPSHOT": {
      const index = state.riskSnapshots.findIndex(
        (snapshot) => snapshot.goalId === action.payload.goalId && snapshot.date === action.payload.date
      );
      if (index >= 0) {
        const next = [...state.riskSnapshots];
        next[index] = action.payload;
        return { ...state, riskSnapshots: next };
      }
      return { ...state, riskSnapshots: [action.payload, ...state.riskSnapshots] };
    }
    case "RESET_ALL":
      return { goals: [], sessions: [], riskSnapshots: [], initialized: true };
    default:
      return state;
  }
}

interface GoalRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  deadline: string;
  total_estimated_hours: number;
  weekly_target_hours: number;
  archived: boolean;
  allowed_sites: unknown;
  created_at: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  goal_id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  moved_forward: string | null;
  hesitation: string | null;
  next_start: string | null;
  difficulty: number | null;
  focus_quality: number | null;
  created_at: string;
}

interface SnapshotRow {
  id: string;
  goal_id: string;
  date: string;
  current_weekly_pace: number | null;
  required_weekly_pace: number | null;
  pace_gap: number | null;
  projected_hours: number | null;
  completion_probability: number | null;
  trajectory_band: string | null;
  created_at: string;
}

function mapGoalRecord(row: GoalRow): GoalRecord {
  const mapped = mapGoalRow(row);
  return {
    ...mapped,
    userId: row.user_id,
    description: row.description ?? "",
    createdAt: row.created_at,
    allowedSites: mapped.allowedSites ?? { categories: [], customSites: [] }
  };
}

function mapSessionRecord(row: SessionRow): SessionRecord {
  const mapped = mapSessionRow(row);
  return {
    ...mapped,
    userId: row.user_id,
    endTime: row.end_time,
    createdAt: row.created_at
  };
}

function mapSnapshotRecord(row: SnapshotRow): RiskSnapshot {
  const trajectoryBand = row.trajectory_band === "Stable" || row.trajectory_band === "Fragile" || row.trajectory_band === "At Risk"
    ? row.trajectory_band
    : "Fragile";

  return {
    id: row.id,
    goalId: row.goal_id,
    date: row.date,
    currentWeeklyPace: row.current_weekly_pace ?? 0,
    requiredWeeklyPace: row.required_weekly_pace ?? 0,
    paceGap: row.pace_gap ?? 0,
    projectedHours: row.projected_hours ?? 0,
    completionProbability: row.completion_probability ?? 0,
    trajectoryBand,
    createdAt: row.created_at
  };
}

interface FocusContextValue {
  state: AppState;
  dispatch: (action: Action) => void;
  refresh: () => Promise<void>;
}

const FocusContext = createContext<FocusContextValue | null>(null);

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [state, localDispatch] = useReducer(reducer, initialState);
  const { user, loading } = useAuth();

  const fetchState = useCallback(async () => {
    if (!user) {
      localDispatch({ type: "LOAD_STATE", payload: { goals: [], sessions: [], riskSnapshots: [] } });
      return;
    }

    const goalsResult = await supabase
      .from("goals")
      .select("id,user_id,name,description,deadline,total_estimated_hours,weekly_target_hours,archived,allowed_sites,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (goalsResult.error) {
      localDispatch({ type: "LOAD_STATE", payload: { goals: [], sessions: [], riskSnapshots: [] } });
      return;
    }

    const goals = (goalsResult.data ?? []).map((row) => mapGoalRecord(row as GoalRow));

    const sessionsResult = await supabase
      .from("sessions")
      .select("id,user_id,goal_id,start_time,end_time,duration_minutes,moved_forward,hesitation,next_start,difficulty,focus_quality,created_at")
      .eq("user_id", user.id)
      .order("start_time", { ascending: false });

    const sessions = sessionsResult.error
      ? []
      : (sessionsResult.data ?? []).map((row) => mapSessionRecord(row as SessionRow));

    let snapshots: RiskSnapshot[] = [];
    const goalIds = goals.map((goal) => goal.id);

    if (goalIds.length > 0) {
      const snapshotsResult = await supabase
        .from("risk_snapshots")
        .select("id,goal_id,date,current_weekly_pace,required_weekly_pace,pace_gap,projected_hours,completion_probability,trajectory_band,created_at")
        .in("goal_id", goalIds)
        .order("date", { ascending: false });

      snapshots = snapshotsResult.error
        ? []
        : (snapshotsResult.data ?? []).map((row) => mapSnapshotRecord(row as SnapshotRow));
    }

    localDispatch({ type: "LOAD_STATE", payload: { goals, sessions, riskSnapshots: snapshots } });
  }, [user]);

  useEffect(() => {
    if (!loading) {
      void fetchState();
    }
  }, [loading, fetchState]);

  const persistGoal = useCallback(async (goal: GoalRecord) => {
    if (!user) {
      return;
    }

    const payload = {
      id: goal.id,
      user_id: user.id,
      name: goal.name,
      description: goal.description || null,
      deadline: goal.deadline,
      total_estimated_hours: goal.totalEstimatedHours,
      weekly_target_hours: goal.weeklyTargetHours,
      archived: goal.archived,
      allowed_sites: goal.allowedSites
    };

    const { error } = await supabase.from("goals").upsert(payload, { onConflict: "id" });
    if (error) {
      void fetchState();
    }
  }, [user, fetchState]);

  const persistSession = useCallback(async (session: SessionRecord) => {
    if (!user) {
      return;
    }

    const payload = {
      id: session.id,
      user_id: user.id,
      goal_id: session.goalId,
      start_time: session.startTime,
      end_time: session.endTime,
      duration_minutes: session.durationMinutes,
      moved_forward: session.movedForward,
      hesitation: session.hesitation,
      next_start: session.nextStart,
      difficulty: session.difficulty,
      focus_quality: session.focusQuality
    };

    const { error } = await supabase.from("sessions").upsert(payload, { onConflict: "id" });
    if (error) {
      void fetchState();
    }
  }, [user, fetchState]);

  const persistSnapshot = useCallback(async (snapshot: RiskSnapshot) => {
    const payload = {
      id: snapshot.id,
      goal_id: snapshot.goalId,
      date: snapshot.date,
      current_weekly_pace: snapshot.currentWeeklyPace,
      required_weekly_pace: snapshot.requiredWeeklyPace,
      pace_gap: snapshot.paceGap,
      projected_hours: snapshot.projectedHours,
      completion_probability: snapshot.completionProbability,
      trajectory_band: snapshot.trajectoryBand
    };

    const { error } = await supabase.from("risk_snapshots").upsert(payload, { onConflict: "id" });
    if (error) {
      void fetchState();
    }
  }, [fetchState]);

  const resetRemoteData = useCallback(async () => {
    if (!user) {
      return;
    }

    const goalIds = state.goals.map((goal) => goal.id);
    if (goalIds.length > 0) {
      await supabase.from("risk_snapshots").delete().in("goal_id", goalIds);
    }

    await supabase.from("sessions").delete().eq("user_id", user.id);
    await supabase.from("weekly_reviews").delete().eq("user_id", user.id);
    await supabase.from("goals").delete().eq("user_id", user.id);
  }, [user, state.goals]);

  const dispatch = useCallback((action: Action) => {
    switch (action.type) {
      case "UPSERT_GOAL":
        localDispatch(action);
        void persistGoal(action.payload);
        return;
      case "ADD_SESSION":
        localDispatch(action);
        void persistSession(action.payload);
        return;
      case "UPSERT_RISK_SNAPSHOT":
        localDispatch(action);
        void persistSnapshot(action.payload);
        return;
      case "RESET_ALL":
        localDispatch(action);
        void resetRemoteData();
        return;
      default:
        localDispatch(action);
    }
  }, [persistGoal, persistSession, persistSnapshot, resetRemoteData]);

  const value = useMemo(
    () => ({ state, dispatch, refresh: fetchState }),
    [state, dispatch, fetchState]
  );

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocus() {
  const ctx = useContext(FocusContext);
  if (!ctx) {
    throw new Error("useFocus must be used within FocusProvider");
  }
  return ctx;
}

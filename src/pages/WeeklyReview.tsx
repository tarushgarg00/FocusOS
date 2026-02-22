import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFocus } from "@/context/FocusContext";
import { buildWeeklyReview } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import type { WeeklyReviewData } from "@/lib/types";

function getWeekStart(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const shift = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + shift);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

interface ReviewRow {
  id: string;
  week_start: string;
  memo: string | null;
  stats_json: unknown;
  created_at: string;
}

interface LegacyReviewData {
  totalSessions: number | null;
  totalHours: number | null;
  averageFocusQuality: number | null;
  emergencyKillCount: number | null;
  primaryFocus: string | null;
  summaryText: string;
  recommendations: string[];
}

function parseWeeklyReviewData(value: unknown): WeeklyReviewData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Partial<WeeklyReviewData>;
  if (!Array.isArray(data.goalSummaries) || !Array.isArray(data.recommendations)) {
    return null;
  }

  return data as WeeklyReviewData;
}

function formatWeekLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function cleanMarkdownText(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLegacyReviewMemo(memo: string | null): LegacyReviewData | null {
  if (!memo) {
    return null;
  }

  const normalized = memo.replace(/\r/g, "\n");
  const plain = cleanMarkdownText(normalized);

  const sessionsMatch = plain.match(/(\d+)\s+sessions?/i);
  const hoursMatch = plain.match(/([0-9]+(?:\.[0-9]+)?)\s+hours?/i);
  const avgFocusMatch = plain.match(/avg focus\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*5/i);
  const emergencyMatch = plain.match(/Emergency Kills?:\s*(\d+)/i);
  const primaryFocusMatch = plain.match(/Primary Focus:\s*(.+?)(?:Recommendation:|$)/i);
  const summaryMatch = plain.match(/Summary:\s*(.+?)(?:Primary Focus:|Recommendation:|$)/i);
  const recommendationMatch = plain.match(/Recommendation:\s*(.+)$/i);

  const recommendations = recommendationMatch?.[1]
    ? [recommendationMatch[1].trim()]
    : [];

  return {
    totalSessions: sessionsMatch ? Number(sessionsMatch[1]) : null,
    totalHours: hoursMatch ? Number(hoursMatch[1]) : null,
    averageFocusQuality: avgFocusMatch ? Number(avgFocusMatch[1]) : null,
    emergencyKillCount: emergencyMatch ? Number(emergencyMatch[1]) : null,
    primaryFocus: primaryFocusMatch?.[1]?.trim() || null,
    summaryText: (summaryMatch?.[1] || plain).trim(),
    recommendations
  };
}

function ReviewDetails({ review }: { review: WeeklyReviewData }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Sessions</p>
          <p className="mt-1 font-mono-calc text-foreground">{review.totalSessions}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Hours</p>
          <p className="mt-1 font-mono-calc text-foreground">{review.totalHours}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Avg focus</p>
          <p className="mt-1 font-mono-calc text-foreground">{review.averageFocusQuality}/5</p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Emergency kills</p>
          <p className="mt-1 font-mono-calc text-foreground">{review.emergencyKillCount}</p>
        </div>
      </div>

      <div className="space-y-3">
        {review.goalSummaries.map((summary) => (
          <div key={summary.goalId} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">{summary.goalName}</p>
              <p className="text-xs text-muted-foreground">{summary.trajectoryBand}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{summary.hoursThisWeek}/{summary.targetHours} hrs this week</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.paceGap > 0 ? `${summary.paceGap.toFixed(1)} hrs behind pace` : "On pace this week"}
            </p>
          </div>
        ))}
      </div>

      <div>
        <p className="section-label mb-2">RECOMMENDATIONS</p>
        <ul className="space-y-1 text-sm text-foreground">
          {review.recommendations.map((recommendation) => (
            <li key={recommendation}>- {recommendation}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LegacyReviewDetails({ review }: { review: LegacyReviewData }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Sessions</p>
          <p className="mt-1 font-mono-calc text-foreground">{review.totalSessions ?? "-"}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Hours</p>
          <p className="mt-1 font-mono-calc text-foreground">{review.totalHours ?? "-"}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Avg focus</p>
          <p className="mt-1 font-mono-calc text-foreground">{review.averageFocusQuality != null ? `${review.averageFocusQuality}/5` : "-"}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Emergency kills</p>
          <p className="mt-1 font-mono-calc text-foreground">{review.emergencyKillCount ?? "-"}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/30 p-3">
        <p className="section-label mb-2">SUMMARY</p>
        <p className="text-sm text-foreground leading-relaxed">{review.summaryText || "No summary available."}</p>
      </div>

      {review.primaryFocus && (
        <div className="rounded-lg border border-border bg-background/30 p-3">
          <p className="section-label mb-2">PRIMARY FOCUS</p>
          <p className="text-sm text-foreground">{review.primaryFocus}</p>
        </div>
      )}

      <div>
        <p className="section-label mb-2">RECOMMENDATIONS</p>
        {review.recommendations.length > 0 ? (
          <ul className="space-y-1 text-sm text-foreground">
            {review.recommendations.map((recommendation) => (
              <li key={recommendation}>- {recommendation}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No recommendation captured in this older review format.</p>
        )}
      </div>
    </div>
  );
}

export default function WeeklyReviewPage() {
  const { user } = useAuth();
  const { state } = useFocus();
  const [currentMemo, setCurrentMemo] = useState<string | null>(null);
  const [currentReview, setCurrentReview] = useState<WeeklyReviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [previousRows, setPreviousRows] = useState<ReviewRow[]>([]);
  const [expandedPreviousId, setExpandedPreviousId] = useState<string | null>(null);

  const weekStart = useMemo(() => getWeekStart(new Date()), []);
  const weekStartIso = useMemo(() => weekStart.toISOString().slice(0, 10), [weekStart]);
  const legacyCurrentReview = useMemo(() => parseLegacyReviewMemo(currentMemo), [currentMemo]);

  const fetchReviews = async () => {
    if (!user) {
      return;
    }

    const currentResult = await supabase
      .from("weekly_reviews")
      .select("id,week_start,memo,stats_json,created_at")
      .eq("user_id", user.id)
      .eq("week_start", weekStartIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!currentResult.error) {
      setCurrentMemo(currentResult.data?.memo ?? null);
      setCurrentReview(parseWeeklyReviewData(currentResult.data?.stats_json));
    }

    const previousResult = await supabase
      .from("weekly_reviews")
      .select("id,week_start,memo,stats_json,created_at")
      .eq("user_id", user.id)
      .neq("week_start", weekStartIso)
      .order("week_start", { ascending: false })
      .limit(8);

    if (!previousResult.error) {
      setPreviousRows((previousResult.data as ReviewRow[]) ?? []);
    }
  };

  useEffect(() => {
    void fetchReviews();
  }, [user, weekStartIso]);

  const generate = async () => {
    if (!user) {
      return;
    }

    setLoading(true);
    const review = buildWeeklyReview(state.goals, state.sessions, state.riskSnapshots, weekStart);

    const existingResult = await supabase
      .from("weekly_reviews")
      .select("id")
      .eq("user_id", user.id)
      .eq("week_start", weekStartIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingResult.data?.id) {
      await supabase
        .from("weekly_reviews")
        .update({ memo: review.memoText, stats_json: review })
        .eq("id", existingResult.data.id);
    } else {
      await supabase
        .from("weekly_reviews")
        .insert({
          id: crypto.randomUUID(),
          user_id: user.id,
          week_start: weekStartIso,
          memo: review.memoText,
          stats_json: review
        });
    }

    setCurrentMemo(review.memoText);
    setCurrentReview(review);
    setLoading(false);
    await fetchReviews();
  };

  return (
    <div className="animate-fade-in mx-auto max-w-content px-8 py-8 space-y-8">
      <h1 className="page-title">Weekly Review</h1>

      <div className="focus-card">
        <div className="section-label mb-4">CURRENT WEEK</div>
        {currentReview ? (
          <div className="space-y-5">
            <ReviewDetails review={currentReview} />

            <button onClick={() => void generate()} className="mt-4 text-sm text-primary hover:underline" disabled={loading}>
              {loading ? "Regenerating..." : "Regenerate"}
            </button>
          </div>
        ) : currentMemo ? (
          <div className="space-y-4">
            {legacyCurrentReview ? <LegacyReviewDetails review={legacyCurrentReview} /> : (
              <div className="rounded-lg border border-border bg-background/50 p-3">
                <p className="text-sm text-muted-foreground">This review was saved in an older format. Regenerate to view the newer structured layout.</p>
              </div>
            )}
            <button onClick={() => void generate()} className="text-sm text-primary hover:underline" disabled={loading}>
              {loading ? "Regenerating..." : "Regenerate in new format"}
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">No review generated for this week yet.</p>
            <button
              onClick={() => void generate()}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              disabled={loading}
            >
              {loading ? "Generating..." : "Generate Weekly Review"}
            </button>
          </div>
        )}
      </div>

      {previousRows.length > 0 && (
        <div className="focus-card">
          <div className="section-label mb-4">PREVIOUS REVIEWS</div>
          <div className="space-y-4">
            {previousRows.map((row) => {
              const parsedReview = parseWeeklyReviewData(row.stats_json);
              const legacyReview = parsedReview ? null : parseLegacyReviewMemo(row.memo);
              const isExpanded = expandedPreviousId === row.id;

              return (
                <div key={row.id} className="rounded-xl border border-border bg-background/20 p-4">
                  <button
                    onClick={() => setExpandedPreviousId((prev) => prev === row.id ? null : row.id)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div>
                      <p className="text-lg font-semibold text-foreground">Week of {formatWeekLabel(row.week_start)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Generated {new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                    </div>
                    <span className="rounded-full border border-primary/30 px-3 py-1 text-xs text-primary">{isExpanded ? "Hide details" : "View details"}</span>
                  </button>

                  {!isExpanded && (
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-2">
                        {parsedReview && (
                          <>
                            <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">{parsedReview.totalSessions} sessions</span>
                            <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">{parsedReview.totalHours} hrs</span>
                            <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">{parsedReview.averageFocusQuality}/5 avg focus</span>
                          </>
                        )}
                        {!parsedReview && legacyReview?.totalSessions != null && (
                          <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">{legacyReview.totalSessions} sessions</span>
                        )}
                        {!parsedReview && legacyReview?.totalHours != null && (
                          <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">{legacyReview.totalHours} hrs</span>
                        )}
                        {!parsedReview && legacyReview?.averageFocusQuality != null && (
                          <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">{legacyReview.averageFocusQuality}/5 avg focus</span>
                        )}
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                        {parsedReview
                          ? parsedReview.recommendations[0] || "No recommendation saved for this week."
                          : legacyReview?.summaryText || "No memo"}
                      </p>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-4 rounded-lg border border-border bg-background/30 p-4">
                      {parsedReview ? (
                        <ReviewDetails review={parsedReview} />
                      ) : legacyReview ? (
                        <LegacyReviewDetails review={legacyReview} />
                      ) : (
                        <div className="rounded-lg border border-border bg-background/50 p-3">
                          <p className="text-sm text-foreground leading-relaxed">No detailed data available for this week.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

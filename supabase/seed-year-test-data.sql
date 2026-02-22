BEGIN;

-- FocusOS Year Seed (skillless model)
-- This script generates ~1 year of realistic test data:
-- - profile (upsert)
-- - 4 goals (3 active + 1 archived)
-- - hundreds of sessions across a year with time-of-day variance
-- - daily risk snapshots
-- - weekly reviews
--
-- User targeting behavior:
-- 1) latest profile.id if available
-- 2) otherwise latest auth.users.id

WITH target_user AS (
  SELECT p.id
  FROM public.profiles p
  ORDER BY p.created_at DESC
  LIMIT 1
),
fallback_user AS (
  SELECT u.id
  FROM auth.users u
  ORDER BY u.created_at DESC
  LIMIT 1
),
config AS (
  SELECT
    COALESCE((SELECT id FROM target_user), (SELECT id FROM fallback_user)) AS user_id,
    (CURRENT_DATE - INTERVAL '364 days')::date AS start_date,
    CURRENT_DATE::date AS end_date
)
INSERT INTO public.profiles (id, name, timezone, week_start_day, created_at)
SELECT
  c.user_id,
  'FocusOS Test User',
  'America/New_York',
  1,
  timezone('utc', now())
FROM config c
WHERE c.user_id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  timezone = EXCLUDED.timezone,
  week_start_day = EXCLUDED.week_start_day;

-- Upsert 4 seeded goals (3 active, 1 archived)
WITH target_user AS (
  SELECT p.id
  FROM public.profiles p
  ORDER BY p.created_at DESC
  LIMIT 1
),
config AS (
  SELECT
    t.id AS user_id
  FROM target_user t
),
goal_seed AS (
  SELECT *
  FROM (
    VALUES
      (
        'a1111111-1111-4111-8111-111111111001'::uuid,
        'Launch FocusOS v1'::text,
        'Ship production-ready core loops, extension, and reliability checks.'::text,
        (CURRENT_DATE + INTERVAL '21 days')::date,
        220::numeric,
        14::numeric,
        FALSE,
        '{"categories":["development","documentation"],"customSites":["supabase.com","vercel.com"]}'::jsonb
      ),
      (
        'a1111111-1111-4111-8111-111111111002'::uuid,
        'NLP Research Sprint'::text,
        'Complete weekly paper review and prototype evaluation pipeline.'::text,
        (CURRENT_DATE + INTERVAL '60 days')::date,
        180::numeric,
        9::numeric,
        FALSE,
        '{"categories":["research","data","learning"],"customSites":["paperswithcode.com"]}'::jsonb
      ),
      (
        'a1111111-1111-4111-8111-111111111003'::uuid,
        'Pitch & Growth Narrative'::text,
        'Refine story, investor collateral, and growth model with evidence.'::text,
        (CURRENT_DATE + INTERVAL '120 days')::date,
        140::numeric,
        6::numeric,
        FALSE,
        '{"categories":["design","documentation","communication"],"customSites":["pitch.com"]}'::jsonb
      ),
      (
        'a1111111-1111-4111-8111-111111111004'::uuid,
        'Archived Sandbox Goal'::text,
        'Historical goal kept for archive-state UI testing.'::text,
        (CURRENT_DATE + INTERVAL '180 days')::date,
        60::numeric,
        3::numeric,
        TRUE,
        '{"categories":["learning"],"customSites":["example.com"]}'::jsonb
      )
  ) AS rows(id, name, description, deadline, total_estimated_hours, weekly_target_hours, archived, allowed_sites)
)
INSERT INTO public.goals (
  id,
  user_id,
  name,
  description,
  deadline,
  total_estimated_hours,
  weekly_target_hours,
  archived,
  allowed_sites,
  created_at
)
SELECT
  g.id,
  c.user_id,
  g.name,
  g.description,
  g.deadline,
  g.total_estimated_hours,
  g.weekly_target_hours,
  g.archived,
  g.allowed_sites,
  timezone('utc', now()) - INTERVAL '365 days'
FROM config c
JOIN goal_seed g ON TRUE
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  deadline = EXCLUDED.deadline,
  total_estimated_hours = EXCLUDED.total_estimated_hours,
  weekly_target_hours = EXCLUDED.weekly_target_hours,
  archived = EXCLUDED.archived,
  allowed_sites = EXCLUDED.allowed_sites;

-- Clear prior seeded records for deterministic reruns
DELETE FROM public.sessions
WHERE goal_id IN (
  'a1111111-1111-4111-8111-111111111001'::uuid,
  'a1111111-1111-4111-8111-111111111002'::uuid,
  'a1111111-1111-4111-8111-111111111003'::uuid,
  'a1111111-1111-4111-8111-111111111004'::uuid
);

DELETE FROM public.risk_snapshots
WHERE goal_id IN (
  'a1111111-1111-4111-8111-111111111001'::uuid,
  'a1111111-1111-4111-8111-111111111002'::uuid,
  'a1111111-1111-4111-8111-111111111003'::uuid
);

DELETE FROM public.weekly_reviews
WHERE stats_json ->> 'seed_source' = 'focusos_year_seed_v1';

-- Generate ~1 year of session history
WITH target_user AS (
  SELECT p.id
  FROM public.profiles p
  ORDER BY p.created_at DESC
  LIMIT 1
),
config AS (
  SELECT
    t.id AS user_id,
    (CURRENT_DATE - INTERVAL '364 days')::date AS start_date,
    CURRENT_DATE::date AS end_date
  FROM target_user t
),
calendar AS (
  SELECT
    gs::date AS day,
    row_number() OVER (ORDER BY gs) - 1 AS day_index,
    extract(isodow FROM gs)::int AS iso_dow
  FROM config c,
       generate_series(c.start_date, c.end_date, INTERVAL '1 day') gs
),
per_day AS (
  SELECT
    day,
    day_index,
    iso_dow,
    (CASE WHEN iso_dow <= 5 THEN 2 ELSE 1 END) + (CASE WHEN day_index % 11 = 0 THEN 1 ELSE 0 END) AS session_count
  FROM calendar
),
expanded AS (
  SELECT
    d.day,
    d.day_index,
    d.iso_dow,
    gs.slot
  FROM per_day d
  JOIN LATERAL generate_series(1, d.session_count) gs(slot) ON TRUE
),
with_goal AS (
  SELECT
    e.*,
    CASE
      WHEN ((e.day_index + e.slot * 3) % 100) < 45 THEN 'a1111111-1111-4111-8111-111111111001'::uuid
      WHEN ((e.day_index + e.slot * 3) % 100) < 75 THEN 'a1111111-1111-4111-8111-111111111002'::uuid
      WHEN ((e.day_index + e.slot * 3) % 100) < 95 THEN 'a1111111-1111-4111-8111-111111111003'::uuid
      ELSE 'a1111111-1111-4111-8111-111111111004'::uuid
    END AS goal_id
  FROM expanded e
),
session_rows AS (
  SELECT
    (
      substr(hash, 1, 8) || '-' ||
      substr(hash, 9, 4) || '-' ||
      substr(hash, 13, 4) || '-' ||
      substr(hash, 17, 4) || '-' ||
      substr(hash, 21, 12)
    )::uuid AS id,
    x.goal_id,
    x.day,
    x.day_index,
    x.iso_dow,
    x.slot,
    hour_of_day,
    minute_of_hour,
    duration_minutes,
    focus_quality,
    difficulty,
    moved_forward,
    hesitation,
    next_start
  FROM (
    SELECT
      wg.*,
      md5(wg.goal_id::text || ':' || wg.day::text || ':' || wg.slot::text) AS hash,
      CASE
        WHEN wg.slot = 1 THEN 7 + (wg.day_index % 4)
        WHEN wg.slot = 2 THEN 13 + (wg.day_index % 4)
        ELSE 19 + (wg.day_index % 3)
      END AS hour_of_day,
      ((wg.day_index * 11 + wg.slot * 17) % 60) AS minute_of_hour,
      CASE
        WHEN wg.slot = 1 THEN 45 + ((wg.day_index + wg.slot * 3) % 31)
        WHEN wg.slot = 2 THEN 30 + ((wg.day_index * 2 + wg.slot * 5) % 26)
        ELSE 20 + (wg.day_index % 21)
      END AS duration_minutes,
      GREATEST(
        1,
        LEAST(
          5,
          ROUND(
            (
              CASE
                WHEN (CASE WHEN wg.slot = 1 THEN 7 + (wg.day_index % 4) WHEN wg.slot = 2 THEN 13 + (wg.day_index % 4) ELSE 19 + (wg.day_index % 3) END) BETWEEN 7 AND 11 THEN 4.4
                WHEN (CASE WHEN wg.slot = 1 THEN 7 + (wg.day_index % 4) WHEN wg.slot = 2 THEN 13 + (wg.day_index % 4) ELSE 19 + (wg.day_index % 3) END) BETWEEN 12 AND 16 THEN 3.5
                ELSE 2.7
              END
              + CASE WHEN wg.iso_dow IN (6, 7) THEN -0.3 ELSE 0.2 END
              + ((wg.day_index % 5) - 2) * 0.08
            )::numeric,
            0
          )
        )
      )::int AS focus_quality,
      (2 + ((wg.day_index + wg.slot * 2 + CASE WHEN wg.goal_id = 'a1111111-1111-4111-8111-111111111001'::uuid THEN 1 WHEN wg.goal_id = 'a1111111-1111-4111-8111-111111111002'::uuid THEN 2 ELSE 3 END) % 4))::int AS difficulty,
      CASE
        WHEN wg.goal_id = 'a1111111-1111-4111-8111-111111111001'::uuid THEN 'Moved FocusOS core milestones forward on ' || to_char(wg.day, 'Mon DD') || '.'
        WHEN wg.goal_id = 'a1111111-1111-4111-8111-111111111002'::uuid THEN 'Advanced NLP research review and synthesis on ' || to_char(wg.day, 'Mon DD') || '.'
        WHEN wg.goal_id = 'a1111111-1111-4111-8111-111111111003'::uuid THEN 'Refined pitch narrative and evidence trail on ' || to_char(wg.day, 'Mon DD') || '.'
        ELSE 'Maintained archival sandbox notes on ' || to_char(wg.day, 'Mon DD') || '.'
      END AS moved_forward,
      CASE
        WHEN (wg.day_index + wg.slot) % 4 = 0 THEN 'Lost momentum after context switching.'
        WHEN (wg.day_index + wg.slot) % 5 = 0 THEN 'Spent too long polishing wording before structure.'
        ELSE NULL
      END AS hesitation,
      CASE
        WHEN wg.goal_id = 'a1111111-1111-4111-8111-111111111001'::uuid THEN 'Open with the highest-risk implementation step.'
        WHEN wg.goal_id = 'a1111111-1111-4111-8111-111111111002'::uuid THEN 'Begin with one paper and extract three actionable insights.'
        WHEN wg.goal_id = 'a1111111-1111-4111-8111-111111111003'::uuid THEN 'Start with one proof point before polishing slides.'
        ELSE 'Review archive and close open loops quickly.'
      END AS next_start
    FROM with_goal wg
  ) x
)
INSERT INTO public.sessions (
  id,
  user_id,
  goal_id,
  start_time,
  end_time,
  duration_minutes,
  moved_forward,
  hesitation,
  next_start,
  difficulty,
  focus_quality,
  created_at
)
SELECT
  sr.id,
  c.user_id,
  sr.goal_id,
  (sr.day + make_interval(hours => sr.hour_of_day::int, mins => sr.minute_of_hour::int))::timestamp,
  (
    sr.day
    + make_interval(hours => sr.hour_of_day::int, mins => sr.minute_of_hour::int)
    + make_interval(mins => sr.duration_minutes::int)
  )::timestamp,
  sr.duration_minutes,
  sr.moved_forward,
  sr.hesitation,
  sr.next_start,
  sr.difficulty,
  sr.focus_quality,
  timezone('utc', now())
FROM session_rows sr
JOIN config c ON TRUE
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  goal_id = EXCLUDED.goal_id,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  duration_minutes = EXCLUDED.duration_minutes,
  moved_forward = EXCLUDED.moved_forward,
  hesitation = EXCLUDED.hesitation,
  next_start = EXCLUDED.next_start,
  difficulty = EXCLUDED.difficulty,
  focus_quality = EXCLUDED.focus_quality;

-- Daily risk snapshots for active goals
WITH config AS (
  SELECT
    (CURRENT_DATE - INTERVAL '364 days')::date AS start_date,
    CURRENT_DATE::date AS end_date
),
active_goals AS (
  SELECT g.id, g.deadline, g.total_estimated_hours
  FROM public.goals g
  WHERE g.id IN (
    'a1111111-1111-4111-8111-111111111001'::uuid,
    'a1111111-1111-4111-8111-111111111002'::uuid,
    'a1111111-1111-4111-8111-111111111003'::uuid
  )
),
dates AS (
  SELECT gs::date AS snapshot_date
  FROM config c,
       generate_series(c.start_date, c.end_date, INTERVAL '1 day') gs
),
goal_dates AS (
  SELECT g.id AS goal_id, g.deadline, g.total_estimated_hours, d.snapshot_date
  FROM active_goals g
  CROSS JOIN dates d
),
metrics AS (
  SELECT
    gd.goal_id,
    gd.snapshot_date,
    gd.deadline,
    gd.total_estimated_hours,
    COALESCE((
      SELECT SUM(s.duration_minutes) / 60.0
      FROM public.sessions s
      WHERE s.goal_id = gd.goal_id
        AND s.start_time::date <= gd.snapshot_date
    ), 0) AS logged_hours,
    COALESCE((
      SELECT SUM(s.duration_minutes) / 60.0
      FROM public.sessions s
      WHERE s.goal_id = gd.goal_id
        AND s.start_time::date > (gd.snapshot_date - INTERVAL '7 days')
        AND s.start_time::date <= gd.snapshot_date
    ), 0) AS current_weekly_pace
  FROM goal_dates gd
),
calc AS (
  SELECT
    m.goal_id,
    m.snapshot_date,
    m.current_weekly_pace,
    GREATEST(0, m.total_estimated_hours - m.logged_hours) AS remaining_hours,
    GREATEST(0.1, CEIL((m.deadline::date - m.snapshot_date)::numeric) / 7.0) AS remaining_weeks
  FROM metrics m
),
final AS (
  SELECT
    c.goal_id,
    c.snapshot_date,
    ROUND(c.current_weekly_pace::numeric, 2) AS current_weekly_pace,
    ROUND((c.remaining_hours / c.remaining_weeks)::numeric, 2) AS required_weekly_pace,
    ROUND(((c.remaining_hours / c.remaining_weeks) - c.current_weekly_pace)::numeric, 2) AS pace_gap,
    ROUND((
      CASE
        WHEN c.remaining_hours <= 0 THEN 1
        ELSE GREATEST(0, LEAST(1, (c.current_weekly_pace * c.remaining_weeks) / NULLIF(c.remaining_hours, 0)))
      END
    )::numeric, 4) AS completion_probability,
    ROUND((
      c.remaining_hours + c.current_weekly_pace * c.remaining_weeks
    )::numeric, 2) AS projected_hours
  FROM calc c
),
rows AS (
  SELECT
    (
      substr(hash, 1, 8) || '-' ||
      substr(hash, 9, 4) || '-' ||
      substr(hash, 13, 4) || '-' ||
      substr(hash, 17, 4) || '-' ||
      substr(hash, 21, 12)
    )::uuid AS id,
    f.*,
    CASE
      WHEN f.pace_gap <= 0 THEN 'Stable'
      WHEN f.pace_gap <= 1.5 THEN 'Fragile'
      ELSE 'At Risk'
    END AS trajectory_band
  FROM (
    SELECT f.*, md5(f.goal_id::text || ':' || f.snapshot_date::text || ':risk') AS hash
    FROM final f
  ) f
)
INSERT INTO public.risk_snapshots (
  id,
  goal_id,
  date,
  current_weekly_pace,
  required_weekly_pace,
  pace_gap,
  projected_hours,
  completion_probability,
  trajectory_band,
  created_at
)
SELECT
  r.id,
  r.goal_id,
  r.snapshot_date,
  r.current_weekly_pace,
  r.required_weekly_pace,
  r.pace_gap,
  r.projected_hours,
  r.completion_probability,
  r.trajectory_band,
  timezone('utc', now())
FROM rows r
ON CONFLICT (id) DO UPDATE SET
  current_weekly_pace = EXCLUDED.current_weekly_pace,
  required_weekly_pace = EXCLUDED.required_weekly_pace,
  pace_gap = EXCLUDED.pace_gap,
  projected_hours = EXCLUDED.projected_hours,
  completion_probability = EXCLUDED.completion_probability,
  trajectory_band = EXCLUDED.trajectory_band;

-- Weekly reviews across the seeded year
WITH target_user AS (
  SELECT p.id
  FROM public.profiles p
  ORDER BY p.created_at DESC
  LIMIT 1
),
config AS (
  SELECT
    t.id AS user_id,
    (date_trunc('week', CURRENT_DATE - INTERVAL '364 days'))::date AS start_week,
    (date_trunc('week', CURRENT_DATE))::date AS end_week
  FROM target_user t
),
weeks AS (
  SELECT gs::date AS week_start
  FROM config c,
       generate_series(c.start_week, c.end_week, INTERVAL '7 days') gs
),
weekly_stats AS (
  SELECT
    w.week_start,
    COUNT(s.id)::int AS total_sessions,
    ROUND(COALESCE(SUM(s.duration_minutes), 0)::numeric / 60.0, 2) AS total_hours,
    ROUND(COALESCE(AVG(s.focus_quality), 0)::numeric, 2) AS avg_focus
  FROM weeks w
  LEFT JOIN public.sessions s
    ON s.start_time::date >= w.week_start
   AND s.start_time::date < (w.week_start + INTERVAL '7 days')
   AND s.goal_id IN (
     'a1111111-1111-4111-8111-111111111001'::uuid,
     'a1111111-1111-4111-8111-111111111002'::uuid,
     'a1111111-1111-4111-8111-111111111003'::uuid
   )
  GROUP BY w.week_start
),
top_goal AS (
  SELECT DISTINCT ON (w.week_start)
    w.week_start,
    g.name AS goal_name,
    ROUND(COALESCE(SUM(s.duration_minutes), 0)::numeric / 60.0, 2) AS hours
  FROM weeks w
  JOIN public.goals g
    ON g.id IN (
      'a1111111-1111-4111-8111-111111111001'::uuid,
      'a1111111-1111-4111-8111-111111111002'::uuid,
      'a1111111-1111-4111-8111-111111111003'::uuid
    )
  LEFT JOIN public.sessions s
    ON s.goal_id = g.id
   AND s.start_time::date >= w.week_start
   AND s.start_time::date < (w.week_start + INTERVAL '7 days')
  GROUP BY w.week_start, g.name
  ORDER BY w.week_start, SUM(s.duration_minutes) DESC NULLS LAST
),
review_rows AS (
  SELECT
    (
      substr(hash, 1, 8) || '-' ||
      substr(hash, 9, 4) || '-' ||
      substr(hash, 13, 4) || '-' ||
      substr(hash, 17, 4) || '-' ||
      substr(hash, 21, 12)
    )::uuid AS id,
    c.user_id,
    ws.week_start,
    (
      '## Weekly Review — ' ||
      to_char(ws.week_start, 'Mon DD') || ' - ' || to_char((ws.week_start + INTERVAL '6 days')::date, 'Mon DD') || E'\n\n' ||
      '**Summary:** ' || ws.total_sessions || ' sessions · ' || ws.total_hours || ' hours · avg focus ' || ws.avg_focus || '/5' || E'\n\n' ||
      '**Primary Focus:** ' || COALESCE(tg.goal_name, 'No dominant goal') ||
      CASE WHEN COALESCE(tg.hours, 0) > 0 THEN ' (' || tg.hours || ' hrs).' ELSE '.' END || E'\n\n' ||
      '**Recommendation:** Keep your highest-energy morning block protected and add one extra recovery session to the most fragile goal.'
    ) AS memo,
    jsonb_build_object(
      'seed_source', 'focusos_year_seed_v1',
      'total_sessions', ws.total_sessions,
      'total_hours', ws.total_hours,
      'avg_focus', ws.avg_focus,
      'top_goal', COALESCE(tg.goal_name, 'None')
    ) AS stats_json
  FROM weekly_stats ws
  JOIN config c ON TRUE
  LEFT JOIN top_goal tg ON tg.week_start = ws.week_start
  CROSS JOIN LATERAL (
    SELECT md5(c.user_id::text || ':' || ws.week_start::text || ':focusos_year_seed_v1') AS hash
  ) h
)
INSERT INTO public.weekly_reviews (
  id,
  user_id,
  week_start,
  memo,
  stats_json,
  created_at
)
SELECT
  rr.id,
  rr.user_id,
  rr.week_start,
  rr.memo,
  rr.stats_json,
  timezone('utc', now())
FROM review_rows rr
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  week_start = EXCLUDED.week_start,
  memo = EXCLUDED.memo,
  stats_json = EXCLUDED.stats_json,
  created_at = EXCLUDED.created_at;

COMMIT;

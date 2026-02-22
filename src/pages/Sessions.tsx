import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFocus } from '@/context/FocusContext';
import { StarRating } from '@/components/StarRating';
import { isEmergencyKillSession, stripEmergencyKillMarker } from '@/lib/analytics';

export default function SessionsPage() {
  const { state } = useFocus();
  const [searchParams] = useSearchParams();
  const filterGoalId = searchParams.get('goalId') ?? 'all';
  const [goalFilter, setGoalFilter] = useState(filterGoalId);
  const [dateFilter, setDateFilter] = useState<'week' | '2weeks' | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState(10);

  const filtered = useMemo(() => {
    let sessions = [...state.sessions];
    if (goalFilter !== 'all') sessions = sessions.filter(s => s.goalId === goalFilter);

    const now = Date.now();
    if (dateFilter === 'week') sessions = sessions.filter(s => now - new Date(s.startTime).getTime() < 7 * 86400000);
    else if (dateFilter === '2weeks') sessions = sessions.filter(s => now - new Date(s.startTime).getTime() < 14 * 86400000);

    return sessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [state.sessions, goalFilter, dateFilter]);

  const totalHours = Math.round(filtered.reduce((s, r) => s + r.durationMinutes, 0) / 60 * 10) / 10;
  const avgFocus = filtered.filter(s => s.focusQuality).length > 0
    ? (filtered.filter(s => s.focusQuality).reduce((s, r) => s + (r.focusQuality ?? 0), 0) / filtered.filter(s => s.focusQuality).length).toFixed(1)
    : '—';

  const visible = filtered.slice(0, visibleCount);

  if (state.sessions.length === 0) {
    return (
      <div className="mx-auto max-w-content px-8 py-8">
        <h1 className="page-title mb-6">Sessions</h1>
        <div className="focus-card text-center py-12">
          <p className="text-sm text-muted-foreground">Your session history will appear here after your first focus session.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in mx-auto max-w-content px-8 py-8 space-y-6">
      <h1 className="page-title">Sessions</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={goalFilter} onChange={e => setGoalFilter(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
          <option value="all">All goals</option>
          {state.goals.filter(g => !g.archived).map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {(['week', '2weeks', 'all'] as const).map(d => (
            <button key={d} onClick={() => setDateFilter(d)} className={`rounded-lg px-3 py-2 text-sm transition-colors ${dateFilter === d ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>
              {d === 'week' ? 'This week' : d === '2weeks' ? 'Last 2 weeks' : 'All time'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-6">
        <div>
          <span className="section-label">Sessions</span>
          <p className="mt-1 font-mono-calc text-foreground">{filtered.length}</p>
        </div>
        <div>
          <span className="section-label">Total hours</span>
          <p className="mt-1 font-mono-calc text-foreground">{totalHours}</p>
        </div>
        <div>
          <span className="section-label">Avg focus</span>
          <p className="mt-1 font-mono-calc text-foreground">{avgFocus}/5</p>
        </div>
      </div>

      {/* Session cards */}
      <div className="space-y-4">
        {visible.map(s => {
          const goal = state.goals.find(g => g.id === s.goalId);
          const emergencyKill = isEmergencyKillSession(s);
          return (
            <div key={s.id} className="focus-card">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(s.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="ml-2 text-sm font-medium text-foreground">
                    {goal?.name}
                  </span>
                </div>
                <span className="font-mono-calc text-sm text-muted-foreground">{s.durationMinutes} min</span>
              </div>
              {emergencyKill && (
                <p className="mt-2 inline-flex rounded border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Emergency Kill</p>
              )}
              {s.focusQuality && (
                <div className="mt-2"><StarRating value={s.focusQuality} readonly size={12} /></div>
              )}
              <p className="mt-2 text-sm text-foreground">{s.movedForward}</p>
              {s.hesitation && (
                <p className="mt-1 text-xs text-muted-foreground">Hesitation: {stripEmergencyKillMarker(s.hesitation)}</p>
              )}
              {s.nextStart && <p className="mt-1 text-xs text-muted-foreground">→ Next: {s.nextStart}</p>}
            </div>
          );
        })}
      </div>

      {filtered.length > visibleCount && (
        <button onClick={() => setVisibleCount(c => c + 10)} className="w-full rounded-lg border border-border py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
          Load more
        </button>
      )}
    </div>
  );
}

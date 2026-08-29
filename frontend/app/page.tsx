'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface Signal {
  id: string;
  service: string;
  title: string;
  max_severity: string;
  risk_score: number;
  priority: string;
  event_count: number;
  start_time: string;
  end_time: string;
  created_at: string;
}

interface HealthStatus {
  status: string;
  version: string;
  providers: {
    database: string;
    redis: string;
    groq: string;
    supabase: string;
  };
  services: {
    redis: string;
    database: string;
    supabase: string;
  };
  queue: { pending: number | null };
}

function priorityColor(p: string): string {
  switch (p) {
    case 'P0':
      return 'bg-red-500 text-white';
    case 'P1':
      return 'bg-orange-500 text-white';
    case 'P2':
      return 'bg-yellow-400 text-yellow-950';
    case 'P3':
      return 'bg-zinc-300 text-zinc-700';
    default:
      return 'bg-zinc-200 text-zinc-500';
  }
}

function severityBadge(s: string): string {
  switch (s) {
    case 'critical':
      return 'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/30 dark:border-red-800';
    case 'high':
      return 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/30 dark:border-amber-800';
    case 'medium':
      return 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:text-yellow-300 dark:bg-yellow-950/30 dark:border-yellow-800';
    case 'low':
      return 'text-slate-700 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700';
    default:
      return 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700';
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}
    />
  );
}

export default function Dashboard() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [signalsRes, healthRes] = await Promise.all([
      fetch('/api/signals?limit=50'),
      fetch('/api/health'),
    ]);

    if (!signalsRes.ok) throw new Error('Failed to load signals');
    const signalsData = await signalsRes.json();
    setSignals(signalsData.signals ?? []);

    if (healthRes.ok) {
      setHealth(await healthRes.json());
    }
  }, []);

  useEffect(() => {
    loadData()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [loadData]);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const p0Count = signals.filter((s) => s.priority === 'P0').length;
  const p1Count = signals.filter((s) => s.priority === 'P1').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Top bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              SignalFlow
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              AI Attention Layer for Incident Management • v1.0.0
            </p>
          </div>

          <div className="flex items-center gap-4">
            {health && (
              <div className="hidden md:flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <StatusDot ok={health.services.database === 'healthy'} />
                  <span className="font-medium">{health.providers.database}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <StatusDot ok={health.services.redis === 'healthy'} />
                  <span className="font-medium">{health.providers.redis}</span>
                </span>
                {health.providers.supabase === 'configured' && (
                  <span className="flex items-center gap-1.5">
                    <StatusDot ok={health.services.supabase === 'healthy'} />
                    <span className="font-medium">supabase</span>
                  </span>
                )}
              </div>
            )}
            <button
              onClick={refresh}
              disabled={refreshing}
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors font-medium"
            >
              {refreshing ? '⟳ Refreshing…' : '⟳ Refresh'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Active Signals</p>
                <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{signals.length}</div>
              </div>
              <div className="text-4xl text-slate-200 dark:text-slate-800">⚠️</div>
            </div>
          </div>
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">P0 Critical</p>
                <div className="text-3xl font-bold text-red-600 mt-2">{p0Count}</div>
              </div>
              <div className="text-4xl">🔴</div>
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">P1 High</p>
                <div className="text-3xl font-bold text-amber-600 mt-2">{p1Count}</div>
              </div>
              <div className="text-4xl">🟠</div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Queue Pending</p>
                <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                  {health?.queue.pending ?? '—'}
                </div>
              </div>
              <div className="text-4xl">⏳</div>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Signals Dashboard
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Correlated events grouped by service • Ranked by risk score
              </p>
            </div>
          </div>

          {loading && (
            <div className="text-center py-24">
              <div className="inline-block">
                <div className="animate-spin text-4xl mb-4">⟳</div>
                <p className="text-slate-500 dark:text-slate-400">Loading signals…</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-200 text-sm mb-6 flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-semibold">Error loading signals</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && signals.length === 0 && (
            <div className="text-center py-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-slate-700 dark:text-slate-300 font-semibold mb-2">No signals yet</p>
              <p className="text-slate-600 dark:text-slate-400 text-sm max-w-md mx-auto">
                Send 2+ events for the same service within 5 minutes to create a signal. 
                Post to <code className="font-mono bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded text-xs">/api/events</code>
              </p>
            </div>
          )}

          {!loading && !error && signals.length > 0 && (
            <div className="space-y-3">
              {signals.map((s) => (
                <Link
                  key={s.id}
                  href={`/signals/${s.id}`}
                  className="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all hover:scale-105 duration-200"
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`inline-flex items-center justify-center w-12 h-12 rounded-lg text-sm font-bold shrink-0 ${priorityColor(s.priority)}`}
                    >
                      {s.priority}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 text-base truncate">
                        {s.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{s.service}</span>
                        <span
                          className={`text-xs px-2 py-1 rounded border capitalize font-medium ${severityBadge(s.max_severity)}`}
                        >
                          {s.max_severity}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {s.event_count} events • {timeAgo(s.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {s.risk_score}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">risk score</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

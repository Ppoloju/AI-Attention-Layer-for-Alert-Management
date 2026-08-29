'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function priorityColor(p: string): string {
  switch (p) {
    case 'P0': return 'bg-red-500 text-white';
    case 'P1': return 'bg-orange-500 text-white';
    case 'P2': return 'bg-yellow-500 text-black';
    case 'P3': return 'bg-zinc-300 text-zinc-700';
    default: return 'bg-zinc-200 text-zinc-500';
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/signals?limit=50')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load signals');
        return r.json();
      })
      .then(data => setSignals(data.signals))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            SignalFlow
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            What needs attention right now?
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-16 text-zinc-400">
            Loading signals…
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && signals.length === 0 && (
          <div className="text-center py-16 text-zinc-400">
            No signals yet. Events will appear here once processed.
          </div>
        )}

        {/* Signal list */}
        {!loading && !error && signals.length > 0 && (
          <div className="space-y-2">
            {signals.map(s => (
              <Link
                key={s.id}
                href={`/signals/${s.id}`}
                className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Priority badge */}
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded text-xs font-bold ${priorityColor(s.priority)}`}>
                    {s.priority}
                  </span>

                  {/* Title + service */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {s.title}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {s.service} · {s.event_count} events · {timeAgo(s.created_at)}
                    </div>
                  </div>

                  {/* Risk score */}
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {s.risk_score}
                    </div>
                    <div className="text-xs text-zinc-400">score</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

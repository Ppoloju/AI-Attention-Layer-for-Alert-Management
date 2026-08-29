'use client';

import { useEffect, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Event {
  id: number;
  source: string;
  event_type: string;
  service: string;
  severity: string;
  timestamp: string;
  message: string;
  metadata: any;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function severityColor(s: string): string {
  switch (s) {
    case 'critical': return 'bg-red-500 text-white';
    case 'high': return 'bg-orange-500 text-white';
    case 'medium': return 'bg-yellow-500 text-black';
    case 'low': return 'bg-green-500 text-white';
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
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/events?limit=50')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load events');
        return r.json();
      })
      .then(data => setEvents(data.events || data))
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
            Event Ingestion Dashboard
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-16 text-zinc-400">
            Loading events…
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && events.length === 0 && (
          <div className="text-center py-16 text-zinc-400">
            No events yet. Send events to POST /api/events to see them here.
          </div>
        )}

        {/* Event list */}
        {!loading && !error && events.length > 0 && (
          <div className="space-y-2">
            {events.map(e => (
              <div
                key={e.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4"
              >
                <div className="flex items-center gap-3">
                  {/* Severity badge */}
                  <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold ${severityColor(e.severity)}`}>
                    {e.severity}
                  </span>

                  {/* Event details */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {e.message}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {e.source} · {e.event_type} · {e.service} · {timeAgo(e.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

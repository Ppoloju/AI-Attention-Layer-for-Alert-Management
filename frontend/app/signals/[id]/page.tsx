'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SignalDetail {
  id: string;
  service: string;
  title: string;
  max_severity: string;
  risk_score: number;
  priority: string;
  representative_message: string;
  event_count: number;
  start_time: string;
  end_time: string;
  created_at: string;
  ai_hypothesis: string | null;
  ai_confidence: string | null;
  ai_evidence: string[];
  ai_next_steps: string[];
  events: Event[];
}

interface Event {
  id: number;
  source: string;
  event_type: string;
  service: string;
  severity: string;
  message: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
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

function severityDot(s: string): string {
  switch (s) {
    case 'critical': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
    case 'low': return 'bg-zinc-400';
    default: return 'bg-zinc-300';
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SignalDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [signal, setSignal] = useState<SignalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/signals/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Signal not found');
        return r.json();
      })
      .then(data => setSignal(data.signal))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-zinc-400">
        Loading signal…
      </div>
    );
  }

  if (error || !signal) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <div className="text-zinc-500">{error || 'Signal not found'}</div>
        <Link href="/" className="text-sm text-blue-500 hover:underline">← Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 mb-4 inline-block">
          ← Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <span className={`inline-flex items-center justify-center w-10 h-10 rounded text-sm font-bold shrink-0 ${priorityColor(signal.priority)}`}>
            {signal.priority}
          </span>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {signal.title}
            </h1>
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {signal.service} · {signal.event_count} events · Score: {signal.risk_score}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Time range */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-400 mb-1">Time range</div>
            <div className="text-sm font-mono text-zinc-700 dark:text-zinc-300">
              {formatTime(signal.start_time)} → {formatTime(signal.end_time)}
            </div>
          </div>

          {/* Risk score */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-400 mb-1">Risk score</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {signal.risk_score}
            </div>
          </div>

          {/* Severity */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-400 mb-1">Max severity</div>
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 capitalize">
              {signal.max_severity}
            </div>
          </div>
        </div>

        {/* AI Triage — only show if available */}
        {signal.ai_hypothesis && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-5 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded">
                AI Triage
              </span>
              <span className="text-xs text-blue-500 dark:text-blue-400">
                {signal.ai_confidence} confidence
              </span>
            </div>

            <p className="text-sm text-blue-900 dark:text-blue-100 mb-4">
              {signal.ai_hypothesis}
            </p>

            {signal.ai_evidence && signal.ai_evidence.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Evidence</div>
                <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  {signal.ai_evidence.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              </div>
            )}

            {signal.ai_next_steps && signal.ai_next_steps.length > 0 && (
              <div>
                <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Recommended next steps</div>
                <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  {signal.ai_next_steps.map((s, i) => (
                    <li key={i}>→ {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Events timeline */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">
            Correlated events
          </h2>
          <div className="space-y-2">
            {signal.events.map(e => (
              <div
                key={e.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${severityDot(e.severity)}`} />
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {e.event_type}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {e.source}
                  </span>
                  <span className="text-xs text-zinc-400 ml-auto font-mono">
                    {formatTime(e.occurred_at)}
                  </span>
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {e.message}
                </p>
                {Object.keys(e.metadata).length > 0 && (
                  <pre className="mt-2 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800 rounded p-2 overflow-x-auto">
                    {JSON.stringify(e.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

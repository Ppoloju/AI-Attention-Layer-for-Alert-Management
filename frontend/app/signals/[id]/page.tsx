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
  timestamp: string;
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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⟳</div>
          <p className="text-slate-600 dark:text-slate-400">Loading signal…</p>
        </div>
      </div>
    );
  }

  if (error || !signal) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center justify-center gap-4">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-slate-700 dark:text-slate-300 font-semibold">{error || 'Signal not found'}</p>
        </div>
        <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">← Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Back link */}
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-6 inline-flex items-center gap-2 font-medium transition-colors">
          ← Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <span className={`inline-flex items-center justify-center w-12 h-12 rounded-lg text-sm font-bold shrink-0 ${priorityColor(signal.priority)}`}>
            {signal.priority}
          </span>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {signal.title}
            </h1>
            <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <p>Service: <span className="font-semibold text-slate-900 dark:text-slate-100">{signal.service}</span></p>
              <p>Events: <span className="font-semibold text-slate-900 dark:text-slate-100">{signal.event_count}</span> • Risk Score: <span className="font-semibold text-slate-900 dark:text-slate-100">{signal.risk_score}</span></p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Time range */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm">
            <div className="text-xs text-slate-600 dark:text-slate-400 font-semibold mb-2">⏱️ Time Range</div>
            <div className="text-sm font-mono text-slate-700 dark:text-slate-300 space-y-1">
              <div>Start: {formatTime(signal.start_time)}</div>
              <div>End: {formatTime(signal.end_time)}</div>
            </div>
          </div>

          {/* Risk score */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm">
            <div className="text-xs text-slate-600 dark:text-slate-400 font-semibold mb-2">🎯 Risk Score</div>
            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {signal.risk_score}
            </div>
          </div>

          {/* Severity */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm">
            <div className="text-xs text-slate-600 dark:text-slate-400 font-semibold mb-2">⚠️ Max Severity</div>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize">
              {signal.max_severity}
            </div>
          </div>
        </div>

        {/* AI Triage — only show if available */}
        {signal.ai_hypothesis && (
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-3 py-1 rounded-full">
                🤖 AI Triage
              </span>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {signal.ai_confidence} confidence
              </span>
            </div>

            <p className="text-sm text-blue-900 dark:text-blue-100 mb-4 leading-relaxed font-medium">
              {signal.ai_hypothesis}
            </p>

            {signal.ai_evidence && signal.ai_evidence.length > 0 && (
              <div className="mb-4 p-3 bg-blue-100/50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
                <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">💡 Evidence</div>
                <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  {signal.ai_evidence.map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <span>✓</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {signal.ai_next_steps && signal.ai_next_steps.length > 0 && (
              <div className="p-3 bg-blue-100/50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
                <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">📋 Recommended Next Steps</div>
                <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  {signal.ai_next_steps.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span>→</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Events timeline */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
            📊 Correlated Events ({signal.events.length})
          </h2>
          <div className="space-y-3">
            {signal.events.map(e => (
              <div
                key={e.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${severityDot(e.severity)}`} />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    {e.event_type}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {e.source}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto font-mono">
                    {formatTime(e.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                  {e.message}
                </p>
                {Object.keys(e.metadata).length > 0 && (
                  <details className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-700">
                    <summary className="text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
                      View Metadata
                    </summary>
                    <pre className="mt-2 text-xs text-slate-700 dark:text-slate-300 overflow-x-auto font-mono">
                      {JSON.stringify(e.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

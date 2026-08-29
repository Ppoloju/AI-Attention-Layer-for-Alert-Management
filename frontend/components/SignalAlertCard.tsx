'use client';

import React from 'react';
import { AlertTriangle, Shield, Clock, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface SignalAlertCardProps {
  title?: string;
  service?: string;
  riskScore?: number;
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  maxSeverity?: 'critical' | 'high' | 'medium' | 'low';
  eventCount?: number;
  timeAgo?: string;
  aiSummary?: string;
  onInvestigate?: () => void;
}

export default function SignalAlertCard({
  title = "Database Connection Pool Exhaustion Detected",
  service = "auth-service-prod",
  riskScore = 88,
  priority = "P0",
  maxSeverity = "critical",
  eventCount = 142,
  timeAgo = "3 mins ago",
  aiSummary = "Connection pool saturation is leading to increased response latency (p99 > 2.5s) on login endpoints.",
  onInvestigate
}: SignalAlertCardProps) {
  
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-500/15',
          border: 'border-red-500/20',
          text: 'text-red-400',
          indicator: 'bg-red-500'
        };
      case 'high':
        return {
          bg: 'bg-orange-500/15',
          border: 'border-orange-500/20',
          text: 'text-orange-400',
          indicator: 'bg-orange-500'
        };
      case 'medium':
        return {
          bg: 'bg-yellow-500/15',
          border: 'border-yellow-500/20',
          text: 'text-yellow-400',
          indicator: 'bg-yellow-500'
        };
      default:
        return {
          bg: 'bg-green-500/15',
          border: 'border-green-500/20',
          text: 'text-green-400',
          indicator: 'bg-green-500'
        };
    }
  };

  const severity = getSeverityStyles(maxSeverity);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950 p-6 shadow-lg transition-all duration-300 hover:border-zinc-700 hover:shadow-2xl">
      
      {/* Risk Score Glow Effect */}
      <div className="absolute top-0 right-0 -mr-6 -mt-6 h-24 w-24 rounded-full bg-red-500/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header Info */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Priority Badge */}
          <span className={`inline-flex h-7 items-center justify-center rounded-lg px-2.5 text-xs font-bold tracking-wider ${
            priority === 'P0' ? 'bg-red-600 text-white' :
            priority === 'P1' ? 'bg-orange-500 text-white' :
            priority === 'P2' ? 'bg-yellow-500 text-zinc-950' :
            'bg-zinc-800 text-zinc-300'
          }`}>
            {priority}
          </span>
          <span className="text-xs font-mono text-zinc-500">
            {service}
          </span>
        </div>

        {/* Risk Circle Badge */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Risk Score</span>
            <span className="text-sm font-bold font-mono text-zinc-200">{riskScore}/100</span>
          </div>
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800/50">
            <Shield className="h-4.5 w-4.5 text-zinc-500" />
            <div className={`absolute top-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-zinc-950 ${severity.indicator}`} />
          </div>
        </div>
      </div>

      {/* Title */}
      <h3 className="mt-4 text-base font-semibold leading-snug text-zinc-100 transition-colors duration-200 group-hover:text-white">
        {title}
      </h3>

      {/* Event Details and Timeline */}
      <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400 font-medium">
        <span className="flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5 text-zinc-500" />
          {eventCount} correlated events
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-zinc-500" />
          {timeAgo}
        </span>
      </div>

      {/* AI Analysis / Summary Section */}
      <div className="mt-5 rounded-xl border border-zinc-900 bg-zinc-900/30 p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
          <Shield className="h-3.5 w-3.5 text-purple-400" />
          <span>AI Triage Analysis</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          {aiSummary}
        </p>
      </div>

      {/* Action / CTA */}
      <div className="mt-6 flex items-center justify-between border-t border-zinc-900 pt-4">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${severity.bg} ${severity.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${severity.indicator}`} />
          {maxSeverity}
        </span>

        <button
          onClick={onInvestigate}
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-100 hover:text-zinc-300 transition-colors duration-200"
        >
          Investigate Signal
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

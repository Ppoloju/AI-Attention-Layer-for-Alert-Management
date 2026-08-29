'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  Bell, ShieldAlert, CheckCircle2, AlertOctagon, HelpCircle, 
  Search, X, ExternalLink, Clock, Play, RefreshCw, Filter, Shield
} from 'lucide-react';
import SignalAlertCard from '../components/SignalAlertCard';

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface Signal {
  id: string;
  service: string;
  title: string;
  max_severity: 'critical' | 'high' | 'medium' | 'low';
  risk_score: number;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  representative_message: string;
  event_count: number;
  start_time: string;
  end_time: string;
  created_at: string;
  status: 'open' | 'resolved';
  ai_hypothesis: string | null;
  ai_confidence: string | null;
  ai_evidence?: string[];
  ai_next_steps?: string[];
  events?: Event[];
}

interface Stats {
  totalEvents: number;
  totalSignals: number;
  resolvedSignals: number;
  openSignals: number;
  noiseReduction: number;
}

export default function Dashboard() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalEvents: 0,
    totalSignals: 0,
    resolvedSignals: 0,
    openSignals: 0,
    noiseReduction: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Filtering State ────────────────────────────────────────────────────────

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'P0' | 'P1' | 'P2' | 'P3'>('all');

  // ─── Drawer State ───────────────────────────────────────────────────────────

  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [drawerSignal, setDrawerSignal] = useState<Signal | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // ─── Fetching Data ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [signalsRes, statsRes] = await Promise.all([
        fetch('/api/signals?limit=50'),
        fetch('/api/stats')
      ]);

      if (!signalsRes.ok || !statsRes.ok) {
        throw new Error('Failed to load dashboard data');
      }

      const signalsData = await signalsRes.json();
      const statsData = await statsRes.json();

      setSignals(signalsData.signals || []);
      setStats(statsData);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while loading data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll every 10 seconds for real-time dashboard updates
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── Fetch Drawer Signal ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedSignalId) {
      setDrawerSignal(null);
      return;
    }

    const fetchDrawerData = async () => {
      setDrawerLoading(true);
      try {
        const res = await fetch(`/api/signals/${selectedSignalId}`);
        if (res.ok) {
          const data = await res.json();
          setDrawerSignal(data.signal);
        }
      } catch (err) {
        console.error('Error fetching signal details:', err);
      } finally {
        setDrawerLoading(false);
      }
    };

    fetchDrawerData();
  }, [selectedSignalId]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleResolveSignal = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'resolved' ? 'open' : 'resolved';
    try {
      const res = await fetch(`/api/signals/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      // Optimistic state update in signals list
      setSignals(prev => prev.map(s => s.id === id ? { ...s, status: nextStatus as any } : s));
      
      // Update drawer signal if currently selected
      setDrawerSignal(prev => prev && prev.id === id ? { ...prev, status: nextStatus as any } : prev);
      
      setStats(prev => {
        const isResolvedNow = nextStatus === 'resolved';
        return {
          ...prev,
          resolvedSignals: isResolvedNow ? prev.resolvedSignals + 1 : prev.resolvedSignals - 1,
          openSignals: isResolvedNow ? prev.openSignals - 1 : prev.openSignals + 1,
        };
      });

      // Fetch fresh data in background to ensure sync
      fetchData();
    } catch (err) {
      console.error('Error resolving signal:', err);
    }
  };

  // ─── Filter Logic ────────────────────────────────────────────────────────────

  const filteredSignals = signals.filter(signal => {
    const matchesSearch = searchQuery === '' || 
      signal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      signal.service.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'open' && signal.status === 'open') ||
      (statusFilter === 'resolved' && signal.status === 'resolved');
      
    const matchesPriority = priorityFilter === 'all' || 
      signal.priority === priorityFilter;
      
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-zinc-800 selection:text-white font-sans antialiased relative overflow-x-hidden">
      {/* Top Banner Navigation */}
      <nav className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
              <ShieldAlert className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                SignalFlow
              </span>
              <span className="text-xs text-zinc-500 font-mono block leading-none">ATTENTION LAYER</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-zinc-400">
            <button 
              onClick={fetchData} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Sync
            </button>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live Ingestion Active
            </span>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400 flex items-center gap-3">
            <AlertOctagon className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* ==================== LEFT SIDEBAR ==================== */}
          <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-6 lg:sticky lg:top-24">
            
            {/* Box 1: Number of Notifications Present */}
            <div className="relative overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-900/30 p-6 backdrop-blur-sm">
              <div className="absolute top-0 right-0 -mr-4 -mt-4 h-16 w-16 rounded-full bg-indigo-500/5 blur-xl" />
              <div className="flex items-center gap-3 text-zinc-400">
                <Bell className="h-5 w-5 text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider">Raw Notifications</span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold font-mono tracking-tight text-white animate-pulse">
                  {loading ? '---' : stats.totalEvents}
                </span>
                <span className="text-xs text-zinc-500 font-medium">total alerts</span>
              </div>
              <p className="mt-2 text-xs text-zinc-500 leading-normal">
                Total unstructured telemetry notifications currently ingested into the pipeline.
              </p>
            </div>

            {/* Box 2: Errors Solved vs Left to Solve */}
            <div className="rounded-2xl border border-zinc-900 bg-zinc-900/30 p-6 flex flex-col gap-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Errors Status Tracker</span>
                <p className="text-xs text-zinc-500 mt-1 leading-normal">Consolidated status of correlated signals needing attention.</p>
              </div>

              {/* Resolved Count Card */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-800/30 bg-zinc-950/40">
                <div>
                  <span className="text-xs font-semibold text-zinc-400">No. Errors Solved</span>
                  <span className="block text-[10px] text-zinc-500 mt-0.5 font-mono">Signals marked resolved</span>
                </div>
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-green-500/20 bg-green-500/5 shadow-[0_0_15px_rgba(34,197,94,0.05)] text-green-400">
                  <CheckCircle2 className="absolute top-0 right-0 h-4.5 w-4.5 text-green-500 bg-zinc-950 rounded-full border border-zinc-950 -mt-1 -mr-1" />
                  <span className="text-lg font-bold font-mono leading-none">{loading ? '-' : stats.resolvedSignals}</span>
                </div>
              </div>

              {/* Left to Solve Count Card */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-800/30 bg-zinc-950/40">
                <div>
                  <span className="text-xs font-semibold text-zinc-400">Left to Solve</span>
                  <span className="block text-[10px] text-zinc-500 mt-0.5 font-mono">Active open signals</span>
                </div>
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.05)] text-amber-400">
                  <AlertOctagon className="absolute top-0 right-0 h-4.5 w-4.5 text-amber-500 bg-zinc-950 rounded-full border border-zinc-950 -mt-1 -mr-1 animate-pulse" />
                  <span className="text-lg font-bold font-mono leading-none">{loading ? '-' : stats.openSignals}</span>
                </div>
              </div>
            </div>

            {/* Box 3: Filters Panel */}
            <div className="rounded-2xl border border-zinc-900 bg-zinc-900/30 p-6 flex flex-col gap-5">
              <div className="flex items-center gap-2 text-zinc-400">
                <Filter className="h-4.5 w-4.5 text-purple-400" />
                <span className="text-xs font-bold uppercase tracking-wider">Search & Filters</span>
              </div>

              {/* Text Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Search signals, services..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Status</span>
                <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
                  {(['all', 'open', 'resolved'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`py-1.5 text-[10px] font-bold rounded-lg capitalize transition-colors ${
                        statusFilter === status 
                          ? 'bg-zinc-850 text-white shadow-sm' 
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {status === 'open' ? 'Active' : status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Priority</span>
                <div className="flex flex-wrap gap-1">
                  {(['all', 'P0', 'P1', 'P2', 'P3'] as const).map((priority) => (
                    <button
                      key={priority}
                      onClick={() => setPriorityFilter(priority)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                        priorityFilter === priority 
                          ? 'bg-zinc-100 text-zinc-950 border-zinc-100 shadow-sm' 
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {priority === 'all' ? 'All Priorities' : priority}
                    </button>
                  ))}
                </div>
              </div>

            </div>
            
          </aside>

          {/* ==================== RIGHT MAIN GRID ==================== */}
          <div className="flex-1 w-full flex flex-col gap-6">
            
            {/* Header Title */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Correlated Signals</h1>
                <p className="text-sm text-zinc-500 mt-0.5">
                  AI-clustered error groups containing correlated event sequences.
                </p>
              </div>
              <span className="text-xs text-zinc-400 font-mono bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-xl">
                {filteredSignals.length} of {signals.length} alerts
              </span>
            </div>

            {/* Grid of Signals */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-12">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="h-64 rounded-2xl border border-zinc-900 bg-zinc-900/10 animate-pulse" />
                ))}
              </div>
            ) : filteredSignals.length === 0 ? (
              <div className="text-center py-20 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/10">
                <HelpCircle className="h-10 w-10 mx-auto text-zinc-500" />
                <h3 className="mt-4 font-semibold text-zinc-300">No signals match criteria</h3>
                <p className="mt-1 text-xs text-zinc-500">Try clearing your filters or search query to find more alerts.</p>
                {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all') && (
                  <button 
                    onClick={() => { setSearchQuery(''); setStatusFilter('all'); setPriorityFilter('all'); }} 
                    className="mt-4 px-4 py-2 rounded-xl text-xs bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border border-zinc-850"
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredSignals.map(signal => (
                  <div 
                    key={signal.id} 
                    onClick={() => setSelectedSignalId(signal.id)}
                    className="cursor-pointer"
                  >
                    <SignalAlertCard
                      title={signal.title}
                      service={signal.service}
                      riskScore={signal.risk_score}
                      priority={signal.priority}
                      maxSeverity={signal.max_severity}
                      eventCount={signal.event_count}
                      timeAgo={`${Math.max(1, Math.round((Date.now() - new Date(signal.start_time).getTime()) / 60000))}m ago`}
                      aiSummary={signal.ai_hypothesis || "No AI summary generated for this correlation yet."}
                      status={signal.status}
                      onResolve={() => handleResolveSignal(signal.id, signal.status)}
                      onInvestigate={() => setSelectedSignalId(signal.id)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Box 3: Noise reduction percentage meter */}
            <div className="rounded-2xl border border-zinc-900 bg-zinc-900/30 p-6 mt-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Noise Reduction Metric</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Ratio of consolidated signals compared to raw alert streams.</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    {loading ? '--' : stats.noiseReduction}%
                  </span>
                  <span className="text-xs text-zinc-500 block leading-none">efficiency increase</span>
                </div>
              </div>
              
              {/* Progress track */}
              <div className="relative h-3 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/50">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${loading ? 0 : stats.noiseReduction}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[10px] text-zinc-500 mt-2 font-mono">
                <span>0% NOISE REDUCTION</span>
                <span>CONSOLIDATED INGESTION METER</span>
                <span>100% MAXIMUM EFFICIENCY</span>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* ==================== SLIDE-OVER DRAWER ==================== */}
      {/* Backdrop */}
      {selectedSignalId && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 cursor-pointer"
          onClick={() => setSelectedSignalId(null)}
        />
      )}

      {/* Sheet panel */}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-[520px] bg-zinc-950 border-l border-zinc-900 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
        selectedSignalId ? 'translate-x-0' : 'translate-x-full'
      }`}>
        
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/10">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">Signal Detail Review</span>
            <h2 className="text-sm font-bold text-zinc-400 mt-0.5 flex items-center gap-1.5">
              ID: <span className="font-mono text-zinc-300">{selectedSignalId}</span>
            </h2>
          </div>
          <button 
            onClick={() => setSelectedSignalId(null)}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {drawerLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
              <RefreshCw className="h-7 w-7 animate-spin text-purple-500" />
              <span className="text-xs font-semibold font-mono">Compiling alert signals...</span>
            </div>
          ) : !drawerSignal ? (
            <div className="text-center py-20 text-zinc-500">
              <AlertOctagon className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
              <p className="text-xs">Failed to load details for this signal.</p>
            </div>
          ) : (
            <>
              {/* Service & Priority */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white leading-tight">{drawerSignal.title}</h3>
                  <span className="inline-block text-xs font-semibold text-zinc-400 mt-2 font-mono">
                    Service: <span className="text-zinc-200">{drawerSignal.service}</span>
                  </span>
                </div>
                <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold bg-zinc-900 border border-zinc-800 ${
                  drawerSignal.priority === 'P0' ? 'text-red-500 border-red-500/20 bg-red-500/5' :
                  drawerSignal.priority === 'P1' ? 'text-orange-500 border-orange-500/20 bg-orange-500/5' :
                  drawerSignal.priority === 'P2' ? 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5' :
                  'text-zinc-400'
                }`}>
                  {drawerSignal.priority}
                </span>
              </div>

              {/* Status & Resolve Button */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/30 border border-zinc-900">
                <div className="flex items-center gap-2">
                  {drawerSignal.status === 'resolved' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-400 bg-green-500/10 rounded-full px-2.5 py-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Resolved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 rounded-full px-2.5 py-0.5 animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Active / Unresolved
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleResolveSignal(drawerSignal.id, drawerSignal.status)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                    drawerSignal.status === 'resolved'
                      ? 'bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300'
                      : 'bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-600/10'
                  }`}
                >
                  {drawerSignal.status === 'resolved' ? 'Reopen Alert' : 'Mark as Resolved'}
                </button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-3 text-center">
                  <span className="block text-[9px] uppercase tracking-wider text-zinc-500">Risk Score</span>
                  <span className="text-lg font-bold font-mono text-zinc-200 mt-1 block">{drawerSignal.risk_score}/100</span>
                </div>
                <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-3 text-center">
                  <span className="block text-[9px] uppercase tracking-wider text-zinc-500">Correlated</span>
                  <span className="text-lg font-bold font-mono text-zinc-200 mt-1 block">{drawerSignal.event_count} events</span>
                </div>
                <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-3 text-center">
                  <span className="block text-[9px] uppercase tracking-wider text-zinc-500">Max Severity</span>
                  <span className="text-xs font-bold capitalize text-zinc-200 mt-2 block">{drawerSignal.max_severity}</span>
                </div>
              </div>

              {/* AI Triage Section */}
              <div className="rounded-2xl border border-purple-500/10 bg-purple-500/5 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400">
                    <Shield className="h-4 w-4" />
                    <span>AI Triage Analysis</span>
                  </div>
                  {drawerSignal.ai_confidence && (
                    <span className="text-[9px] font-bold bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded uppercase font-mono">
                      {drawerSignal.ai_confidence} confidence
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed text-zinc-300">
                  {drawerSignal.ai_hypothesis || "No root cause hypothesis generated yet."}
                </p>

                {/* Evidence logs */}
                {drawerSignal.ai_evidence && drawerSignal.ai_evidence.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="block text-[9px] uppercase tracking-wider text-purple-400 font-bold">Evidence</span>
                    <ul className="text-xs text-zinc-400 space-y-1">
                      {drawerSignal.ai_evidence.map((evidence, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-purple-500">•</span>
                          {evidence}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Next steps */}
                {drawerSignal.ai_next_steps && drawerSignal.ai_next_steps.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-purple-500/10">
                    <span className="block text-[9px] uppercase tracking-wider text-purple-400 font-bold">Recommended Next Steps</span>
                    <ul className="text-xs text-zinc-300 space-y-1.5">
                      {drawerSignal.ai_next_steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-purple-500/15 text-[9px] font-bold text-purple-300 font-mono">
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Correlated Events List (Errors) */}
              <div className="space-y-3">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Correlated Event Logs</span>
                
                {drawerSignal.events && drawerSignal.events.length > 0 ? (
                  <div className="space-y-3">
                    {drawerSignal.events.map((event) => (
                      <div 
                        key={event.id}
                        className="p-4 rounded-xl border border-zinc-900 bg-zinc-900/10 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                          <span className="font-semibold text-zinc-400">{event.event_type}</span>
                          <span>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                        <p className="text-zinc-300 font-medium leading-relaxed">{event.message}</p>
                        
                        <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-1 border-t border-zinc-900/60 font-mono">
                          <span>Source: {event.source}</span>
                          <span className="uppercase text-amber-500">{event.severity}</span>
                        </div>
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <pre className="text-[10px] text-zinc-500 bg-zinc-950 p-2 rounded border border-zinc-900/60 overflow-x-auto font-mono">
                            {JSON.stringify(event.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-zinc-500 text-xs font-mono">
                    No correlated raw event logs.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>

    </div>
  );
}

// ─── Configuration ───────────────────────────────────────────────────────────

export interface CorrelationConfig {
  /** Time window in minutes within which events are candidates for the same signal */
  timeWindowMinutes: number;
  /** Minimum events to form a signal */
  minEventsForSignal: number;
  /** Require shared keywords between events (in addition to type compatibility) */
  requireSharedKeywords: boolean;
  /** Minimum number of shared keywords required */
  minSharedKeywords: number;
}

export const DEFAULT_CONFIG: CorrelationConfig = {
  timeWindowMinutes: 5,
  minEventsForSignal: 2,
  requireSharedKeywords: false,
  minSharedKeywords: 1,
};

// ─── Event type compatibility ────────────────────────────────────────────────
//
// Types that commonly co-occur during the same incident.
// The map is intentionally broad — most error-adjacent types are compatible
// with each other.  The time window and keyword checks provide additional
// discrimination.

const TYPE_COMPATIBILITY: Record<string, string[]> = {
  error:            ['error', 'http_error', 'latency', 'warning', 'database_error'],
  http_error:       ['http_error', 'error', 'latency', 'warning', 'database_error'],
  latency:          ['latency', 'error', 'http_error', 'warning', 'database_error'],
  warning:          ['warning', 'error', 'http_error', 'latency', 'database_error'],
  deployment:       ['deployment', 'error', 'warning', 'http_error'],
  database_error:   ['database_error', 'error', 'http_error', 'latency', 'warning'],
  info:             ['info', 'warning'],
};

function areTypesCompatible(type1: string, type2: string): boolean {
  const t1 = type1.toLowerCase();
  const t2 = type2.toLowerCase();
  const compat = TYPE_COMPATIBILITY[t1];
  if (compat) return compat.includes(t2);
  return t1 === t2;
}

/** Check if an event's type is compatible with ANY event type in the group */
function isCompatibleWithGroup(eventType: string, groupTypes: string[]): boolean {
  return groupTypes.some(t => areTypesCompatible(eventType, t));
}

// ─── Keyword extraction ──────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'been', 'were', 'they', 'them',
  'their', 'what', 'when', 'where', 'will', 'just', 'like', 'more', 'some',
  'such', 'only', 'into', 'over', 'also', 'not', 'are', 'was', 'for', 'but',
  'can', 'had', 'has', 'its', 'may', 'our', 'out', 'own', 'too', 'all',
  'any', 'because', 'between', 'each', 'even', 'most', 'new', 'now', 'old',
  'see', 'way', 'who', 'did', 'get', 'let', 'say', 'she', 'two', 'use',
]);

export function extractKeywords(message: string): string[] {
  const words = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));

  return [...new Set(words)];
}

function countSharedKeywordCount(messages: string[]): number {
  if (messages.length < 2) return 0;

  const keywordSets = messages.map(msg => new Set(extractKeywords(msg)));

  const allKeywords = new Set<string>();
  for (const s of keywordSets) {
    for (const kw of s) allKeywords.add(kw);
  }

  let shared = 0;
  for (const kw of allKeywords) {
    let count = 0;
    for (const s of keywordSets) {
      if (s.has(kw)) count++;
      if (count >= 2) { shared++; break; }
    }
  }
  return shared;
}

// ─── Signal generation ───────────────────────────────────────────────────────

function toISOString(val: string | Date): string {
  return val instanceof Date ? val.toISOString() : new Date(val).toISOString();
}

function generateSignalId(service: string, events: EventRow[]): string {
  const sorted = [...events].sort(
    (a, b) => new Date(toISOString(a.timestamp)).getTime() - new Date(toISOString(b.timestamp)).getTime()
  );
  const start = toISOString(sorted[0].timestamp).replace(/[^0-9]/g, '').slice(0, 14);
  const hash = events.length.toString(36);
  return `sig-${service}-${start}-${hash}`;
}

function generateTitle(events: EventRow[]): string {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...events].sort(
    (a, b) =>
      (severityOrder[a.severity as keyof typeof severityOrder] ?? 4) -
      (severityOrder[b.severity as keyof typeof severityOrder] ?? 4)
  );
  const representative = sorted[0];
  const eventTypes = [...new Set(events.map(e => e.event_type))].join(' + ');
  return `${representative.service}: ${eventTypes}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface EventRow {
  id: number;
  source: string;
  event_type: string;
  service: string;
  severity: string;
  message: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  created_at: string;
}

export interface SignalGroup {
  signalId: string;
  service: string;
  title: string;
  eventIds: number[];
  eventCount: number;
  startTime: string;
  endTime: string;
  maxSeverity: string;
  representativeMessage: string;
}

/**
 * Correlate a list of events into signal groups.
 *
 * Algorithm:
 * 1. Group events by service.
 * 2. Within each service, sort by timestamp.
 * 3. Greedily assign each event to the first compatible group, or start a new one.
 * 4. Two events are compatible if:
 *    a. They fall within `timeWindowMinutes` of the group's first event.
 *    b. Their event type is compatible with ANY type already in the group,
 *       OR their messages share keywords.
 * 5. Groups with ≥ minEventsForSignal become signals.
 */
export function correlateEvents(
  events: EventRow[],
  config: Partial<CorrelationConfig> = {}
): SignalGroup[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (events.length === 0) return [];

  // Pre-group by service
  const byService = new Map<string, EventRow[]>();
  for (const event of events) {
    const list = byService.get(event.service) || [];
    list.push(event);
    byService.set(event.service, list);
  }

  const allSignals: SignalGroup[] = [];

  for (const [, serviceEvents] of byService) {
    const signals = correlateServiceEvents(serviceEvents, cfg);
    allSignals.push(...signals);
  }

  return allSignals;
}

function correlateServiceEvents(
  events: EventRow[],
  cfg: CorrelationConfig
): SignalGroup[] {
  // Sort by timestamp ascending
  const sorted = [...events].sort(
    (a, b) => new Date(toISOString(a.timestamp)).getTime() - new Date(toISOString(b.timestamp)).getTime()
  );

  const timeWindowMs = cfg.timeWindowMinutes * 60 * 1000;

  // Greedy grouping
  const groups: EventRow[][] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (assigned.has(sorted[i].id)) continue;

    const groupStart = new Date(toISOString(sorted[i].timestamp)).getTime();
    const currentGroup: EventRow[] = [sorted[i]];
    assigned.add(sorted[i].id);

    for (let j = i + 1; j < sorted.length; j++) {
      if (assigned.has(sorted[j].id)) continue;

      const candidateTime = new Date(toISOString(sorted[j].timestamp)).getTime();
      const withinWindow = candidateTime - groupStart <= timeWindowMs;

      if (!withinWindow) continue;

      // Check type compatibility against ANY event in the group
      const groupTypes = currentGroup.map(e => e.event_type);
      const typeCompatible = isCompatibleWithGroup(sorted[j].event_type, groupTypes);

      // Check keyword overlap as additional signal
      const testMessages = [...currentGroup, sorted[j]].map(e => e.message);
      const keywordOverlap = countSharedKeywordCount(testMessages) >= cfg.minSharedKeywords;

      // Accept if type-compatible OR has keyword overlap
      if (typeCompatible || keywordOverlap) {
        currentGroup.push(sorted[j]);
        assigned.add(sorted[j].id);
      }
    }

    groups.push(currentGroup);
  }

  // Filter by minimum event count and build SignalGroups
  return groups
    .filter(g => g.length >= cfg.minEventsForSignal)
    .map(group => {
      const timestamps = group.map(e => new Date(toISOString(e.timestamp)).getTime());
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const maxSev = group.reduce((worst, e) => {
        const rank = severityOrder[e.severity as keyof typeof severityOrder] ?? 4;
        const worstRank = severityOrder[worst as keyof typeof severityOrder] ?? 4;
        return rank < worstRank ? e.severity : worst;
      }, group[0].severity);

      const repEvent = [...group].sort(
        (a, b) =>
          (severityOrder[a.severity as keyof typeof severityOrder] ?? 4) -
          (severityOrder[b.severity as keyof typeof severityOrder] ?? 4)
      )[0];

      return {
        signalId: generateSignalId(group[0].service, group),
        service: group[0].service,
        title: generateTitle(group),
        eventIds: group.map(e => e.id),
        eventCount: group.length,
        startTime: new Date(Math.min(...timestamps)).toISOString(),
        endTime: new Date(Math.max(...timestamps)).toISOString(),
        maxSeverity: maxSev,
        representativeMessage: repEvent.message,
      };
    });
}

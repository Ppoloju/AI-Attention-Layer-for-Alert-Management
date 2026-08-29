// In-memory mock store to fallback on if PostgreSQL/Redis is not running.
// Binds to global context to survive Next.js dev server hot-reloads and bundle isolation.

export interface MockSignal {
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
  ai_evidence: string[];
  ai_next_steps: string[];
}

const globalForMock = global as unknown as { mockSignals: MockSignal[] };

if (!globalForMock.mockSignals) {
  globalForMock.mockSignals = [
    {
      id: "sig_db_pool",
      service: "auth-service-prod",
      title: "Database Connection Pool Exhaustion Detected",
      max_severity: "critical",
      risk_score: 88,
      priority: "P0",
      representative_message: "Connection pool saturation leading to increased response latency (p99 > 2.5s) on login endpoints.",
      event_count: 142,
      start_time: new Date(Date.now() - 3 * 60000).toISOString(),
      end_time: new Date().toISOString(),
      created_at: new Date(Date.now() - 3 * 60000).toISOString(),
      status: "open",
      ai_hypothesis: "Connection pool saturation is leading to increased response latency on login endpoints.",
      ai_confidence: "high",
      ai_evidence: [
        "Active connections reached hard limit (100/100)",
        "Connection acquisition timeout rate spiked to 12%",
        "Client request latency p99 exceeded 2.5s"
      ],
      ai_next_steps: [
        "Scale up replica connection pool size temporarily",
        "Investigate unindexed query load on auth schema",
        "Restart auth-service-prod tasks to release stale connections"
      ]
    },
    {
      id: "sig_auth_5xx",
      service: "gateway-service",
      title: "High HTTP 5xx Error Rate on /oauth/token",
      max_severity: "high",
      risk_score: 75,
      priority: "P1",
      representative_message: "Rate of server-side errors has exceeded 5% threshold over the last 5 minutes.",
      event_count: 85,
      start_time: new Date(Date.now() - 15 * 60000).toISOString(),
      end_time: new Date().toISOString(),
      created_at: new Date(Date.now() - 15 * 60000).toISOString(),
      status: "open",
      ai_hypothesis: "Downstream auth service instances are returning 503 Service Unavailable, triggering gateway retries.",
      ai_confidence: "medium",
      ai_evidence: [
        "503 Service Unavailable errors returned by downstream auth-service",
        "Gateway latency spiked during authentication calls",
        "Circuit breaker tripped on oauth-route"
      ],
      ai_next_steps: [
        "Check health checkpoints of auth-service tasks",
        "Verify container logs for out-of-memory crashes on auth-service",
        "Roll back latest deployment for gateway auth module"
      ]
    },
    {
      id: "sig_cpu_spike",
      service: "billing-worker",
      title: "CPU Spike on billing-worker-node-03",
      max_severity: "high",
      risk_score: 68,
      priority: "P1",
      representative_message: "Container CPU utilization sustained above 90% for more than 10 minutes.",
      event_count: 24,
      start_time: new Date(Date.now() - 22 * 60000).toISOString(),
      end_time: new Date().toISOString(),
      created_at: new Date(Date.now() - 22 * 60000).toISOString(),
      status: "open",
      ai_hypothesis: "Heavy cron job executing monthly subscription renewal invoices is running single-threaded on a constrained node.",
      ai_confidence: "high",
      ai_evidence: [
        "billing-worker-03 CPU utilization peaked at 96%",
        "Job queue thread pool fully saturated",
        "GC pause times increased to >500ms"
      ],
      ai_next_steps: [
        "Trigger auto-scaler to add worker instances",
        "Re-allocate billing queue partitions to distribute load",
        "Check database query analyzer for slow updates to invoice table"
      ]
    },
    {
      id: "sig_k8s_evict",
      service: "payment-api",
      title: "Kubernetes Pod Eviction Alert",
      max_severity: "critical",
      risk_score: 92,
      priority: "P0",
      representative_message: "Node kube-worker-09 is low on ephemeral storage, triggering pod evictions.",
      event_count: 4,
      start_time: new Date(Date.now() - 8 * 60000).toISOString(),
      end_time: new Date().toISOString(),
      created_at: new Date(Date.now() - 8 * 60000).toISOString(),
      status: "open",
      ai_hypothesis: "Unbounded logging to local node filesystems by third-party tracing sidecars has filled the node storage disk.",
      ai_confidence: "high",
      ai_evidence: [
        "Kubelet emitted DiskPressure taint on worker-09",
        "Ephemeral storage limit reached on pod payment-api-abc-123",
        "Logs volume size exceeded 50GB allocation"
      ],
      ai_next_steps: [
        "Trigger log truncation on worker-09 filesystem",
        "Verify container logs rotation config files",
        "Reschedule evicted pods to other healthy worker nodes"
      ]
    },
    {
      id: "sig_redis_repl",
      service: "cache-redis-cluster",
      title: "Redis Replication Delay Warning",
      max_severity: "medium",
      risk_score: 52,
      priority: "P2",
      representative_message: "Replication offset lag between primary and replica-02 has exceeded 10MB.",
      event_count: 12,
      start_time: new Date(Date.now() - 45 * 60000).toISOString(),
      end_time: new Date().toISOString(),
      created_at: new Date(Date.now() - 45 * 60000).toISOString(),
      status: "resolved",
      ai_hypothesis: "Network bandwidth constriction between AZ-East and AZ-West causing packet drops during backup replication synchronization.",
      ai_confidence: "high",
      ai_evidence: [
        "Network packet drop rate increased to 4.2% on repl-link",
        "Replication offset delay spiked to 14.5MB",
        "Replica-02 status changed to out-of-sync"
      ],
      ai_next_steps: [
        "Check cloud provider network status dashboards",
        "Force complete resync of replication buffer",
        "Monitor read-latency on AZ-West cached routes"
      ]
    },
    {
      id: "sig_rate_limit",
      service: "public-api-gateway",
      title: "API Rate Limiting Active",
      max_severity: "low",
      risk_score: 30,
      priority: "P3",
      representative_message: "Client IP 198.51.100.42 has exceeded standard tier limit of 100 req/sec.",
      event_count: 950,
      start_time: new Date(Date.now() - 30 * 60000).toISOString(),
      end_time: new Date().toISOString(),
      created_at: new Date(Date.now() - 30 * 60000).toISOString(),
      status: "resolved",
      ai_hypothesis: "Automated scraping activity targeting public search endpoints; throttled successfully by rate-limiter middleware rules.",
      ai_confidence: "high",
      ai_evidence: [
        "Request rate from 198.51.100.42 reached 240/sec",
        "Middleware block triggered on public search paths",
        "950 requests returned HTTP 429 Too Many Requests"
      ],
      ai_next_steps: [
        "Verify client IP address origin and ASN profile",
        "No critical actions required - rate limiting acted correctly",
        "Review rate limit thresholds for search endpoints"
      ]
    }
  ];
}

const mockSignals = globalForMock.mockSignals;

export function getMockSignals() {
  return mockSignals;
}

export function getMockSignalById(id: string) {
  const signal = mockSignals.find(s => s.id === id);
  if (!signal) return null;
  
  return {
    ...signal,
    events: [
      {
        id: 1,
        source: signal.service,
        event_type: "error_log",
        service: signal.service,
        severity: signal.max_severity,
        message: signal.representative_message,
        metadata: { path: "/v1/api", error_code: "500_server_error" },
        timestamp: signal.start_time
      },
      {
        id: 2,
        source: "monitoring-daemon",
        event_type: "metric_alert",
        service: signal.service,
        severity: "medium",
        message: `High resource utilization detected on ${signal.service}`,
        metadata: { metric: "utilization", value: "92%" },
        timestamp: signal.end_time
      }
    ]
  };
}

export function updateMockSignalStatus(id: string, status: 'open' | 'resolved') {
  const index = mockSignals.findIndex(s => s.id === id);
  if (index !== -1) {
    mockSignals[index].status = status;
    return mockSignals[index];
  }
  return null;
}

export function getMockStats() {
  const totalSignals = mockSignals.length;
  const resolvedSignals = mockSignals.filter(s => s.status === 'resolved').length;
  const openSignals = totalSignals - resolvedSignals;
  
  const baseEvents = mockSignals.reduce((acc, s) => acc + s.event_count, 0);
  const totalEvents = baseEvents + 235; 

  const reduction = ((totalEvents - totalSignals) / totalEvents) * 100;

  return {
    totalEvents,
    totalSignals,
    resolvedSignals,
    openSignals,
    noiseReduction: parseFloat(reduction.toFixed(1))
  };
}

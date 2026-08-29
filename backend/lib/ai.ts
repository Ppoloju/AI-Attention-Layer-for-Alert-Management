// ─── Groq AI Boundary ────────────────────────────────────────────────────────
//
// This is the ONLY file that touches the Groq API.
// Everything else in the codebase calls `groqTriage()` and receives
// a structured result or null on failure.

import Groq from 'groq-sdk';

// ─── Configuration ───────────────────────────────────────────────────────────

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

const MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TriageInput {
  signalId: string;
  service: string;
  title: string;
  maxSeverity: string;
  riskScore: number;
  priority: string;
  eventCount: number;
  startTime: string;
  endTime: string;
  events: Array<{
    event_type: string;
    severity: string;
    message: string;
    source: string;
    metadata: Record<string, unknown>;
  }>;
}

export interface TriageResult {
  hypothesis: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  nextSteps: string[];
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildPrompt(input: TriageInput): string {
  // Build factual evidence block from actual event data
  const evidenceBlock = input.events
    .map(
      (e, i) =>
        `Event ${i + 1}: [${e.severity}] ${e.event_type} via ${e.source}\n` +
        `  Message: ${e.message}\n` +
        `  Metadata: ${JSON.stringify(e.metadata)}`
    )
    .join('\n');

  const systemPrompt = `You are an incident triage assistant for operational signals.

RULES:
1. You must ONLY reason from the FACTS provided. Every claim in "evidence" must directly reference an event.
2. Your "hypothesis" is an INTERPRETATION — clearly mark it as your inference, not a fact.
3. "nextSteps" must be actionable, specific, and relevant to the evidence.
4. NEVER fabricate events, metrics, or data that are not provided.
5. Keep responses concise — max 2-3 sentences for hypothesis, 3-5 items for evidence and nextSteps.

Return ONLY valid JSON with this exact structure:
{
  "hypothesis": "string — your interpretation of what's happening",
  "confidence": "high" | "medium" | "low",
  "evidence": ["string — factual observations from the events, each referencing specific event data"],
  "nextSteps": ["string — specific actionable next steps"]
}`;

  const userPrompt = `Analyze this incident signal and provide triage.

Signal: ${input.title}
Service: ${input.service}
Priority: ${input.priority} (risk score: ${input.riskScore})
Time range: ${input.startTime} → ${input.endTime}
Event count: ${input.eventCount}

FACTUAL EVIDENCE (events):
${evidenceBlock}

Provide your triage as JSON.`;

  return JSON.stringify([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);
}

// ─── API call ────────────────────────────────────────────────────────────────

/**
 * Call Groq for AI triage on a signal.
 *
 * Returns null if:
 *   - GROQ_API_KEY is not set
 *   - The API call fails
 *   - The response cannot be parsed
 *
 * The deterministic risk score remains the source of priority.
 * Groq provides supplementary triage only.
 */
export async function groqTriage(input: TriageInput): Promise<TriageResult | null> {
  // Guard: no API key → graceful skip
  if (!process.env.GROQ_API_KEY) {
    console.log('Groq triage skipped: GROQ_API_KEY not set');
    return null;
  }

  try {
    const messages = JSON.parse(buildPrompt(input));

    const response = await groq.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('Groq triage: empty response');
      return null;
    }

    const parsed = JSON.parse(content);

    // Validate required fields
    if (
      typeof parsed.hypothesis !== 'string' ||
      !['high', 'medium', 'low'].includes(parsed.confidence) ||
      !Array.isArray(parsed.evidence) ||
      !Array.isArray(parsed.nextSteps)
    ) {
      console.error('Groq triage: invalid response structure', parsed);
      return null;
    }

    return {
      hypothesis: parsed.hypothesis,
      confidence: parsed.confidence,
      evidence: parsed.evidence.filter((e: unknown) => typeof e === 'string'),
      nextSteps: parsed.nextSteps.filter((s: unknown) => typeof s === 'string'),
    };
  } catch (error) {
    console.error('Groq triage failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

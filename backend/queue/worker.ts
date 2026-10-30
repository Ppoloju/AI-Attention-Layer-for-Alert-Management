import { loadRootEnv } from '../../shared/lib/load-env';

loadRootEnv();
import {
  initializeDatabase,
  insertEvent,
  getRecentEventsForService,
  insertSignal,
  linkSignalEvents,
  updateSignalTriage,
} from '../../shared/lib/db';
import EventQueue from '../lib/redis';
import { EventSchema } from '../../shared/schemas/event';
import { correlateEvents } from '../services/correlation';
import { scoreFromSignal } from '../services/scoring';
import { triageSignal, type SignalForTriage } from '../services/triage';

const queue = new EventQueue();
const POLL_INTERVAL = 1000; // 1 second

async function processEvent(event: unknown): Promise<boolean> {
  const validationResult = EventSchema.safeParse(event);

  if (!validationResult.success) {
    console.error('Invalid event:', validationResult.error.issues);
    return true;
  }

  try {
    const persistedEvent = await insertEvent(validationResult.data);
    console.log(`Event persisted: ${persistedEvent.id} ${persistedEvent.event_type}`);

    await runCorrelation(persistedEvent.service);
    return true;
  } catch (error) {
    console.error('Error processing event:', error);
    return false;
  }
}

async function runCorrelation(service: string) {
  try {
    // Fetch recent events for this service (within the correlation time window)
    const recentEvents = await getRecentEventsForService(service, 5);

    if (recentEvents.length < 2) return;

    // Run the correlation algorithm
    const signals = correlateEvents(recentEvents);

    // Persist any new signals (ON CONFLICT DO NOTHING for idempotency)
    for (const signal of signals) {
      // 3. Calculate deterministic risk score
      const riskScore = scoreFromSignal({
        maxSeverity: signal.maxSeverity,
        eventCount: signal.eventCount,
        startTime: signal.startTime,
        endTime: signal.endTime,
        events: recentEvents
          .filter(e => signal.eventIds.includes(e.id))
          .map(e => ({ event_type: e.event_type })),
      });

      const inserted = await insertSignal({
        id: signal.signalId,
        service: signal.service,
        title: signal.title,
        maxSeverity: signal.maxSeverity,
        riskScore: riskScore.score,
        priority: riskScore.priority,
        representativeMessage: signal.representativeMessage,
        eventCount: signal.eventCount,
        startTime: signal.startTime,
        endTime: signal.endTime,
      });

      if (inserted) {
        await linkSignalEvents(signal.signalId, signal.eventIds);
        console.log(
          `Signal created: ${signal.signalId} (${signal.eventCount} events) → ${riskScore.priority} (score: ${riskScore.score})`
        );

        // 4. Run AI triage (async, graceful fallback)
        await runTriage(signal.signalId, {
          id: signal.signalId,
          service: signal.service,
          title: signal.title,
          maxSeverity: signal.maxSeverity,
          riskScore: riskScore.score,
          priority: riskScore.priority,
          eventCount: signal.eventCount,
          startTime: signal.startTime,
          endTime: signal.endTime,
          events: recentEvents
            .filter(e => signal.eventIds.includes(e.id))
            .map(e => ({
              event_type: e.event_type,
              severity: e.severity,
              message: e.message,
              source: e.source,
              metadata: typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata,
            })),
        });
      }
    }
  } catch (error) {
    console.error(`Correlation error for service ${service}:`, error);
  }
}

async function runTriage(signalId: string, signal: SignalForTriage) {
  try {
    const result = await triageSignal(signal);

    if (result) {
      await updateSignalTriage(signalId, result);
      console.log(
        `Triage complete: ${signalId} → ${result.confidence} confidence`
      );
    }
  } catch (error) {
    console.error(`Triage error for ${signalId}:`, error);
  }
}

async function startWorker() {
  console.log('Starting worker...');
  await initializeDatabase();
  console.log('Database initialized');

  while (true) {
    try {
      const event = await queue.dequeue();

      if (event) {
        const processed = await processEvent(event);

        if (!processed) {
          const validationResult = EventSchema.safeParse(event);
          if (validationResult.success) {
            await queue.enqueue(validationResult.data);
          }
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      }
    } catch (error) {
      console.error('Worker error:', error);
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }
}

startWorker().catch(console.error);

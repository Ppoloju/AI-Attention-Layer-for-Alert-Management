import { z } from 'zod';

export const EventSchema = z.object({
  source: z.enum(['github', 'slack', 'jira', 'prometheus', 'custom']),
  event_type: z.string(),
  service: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  timestamp: z.string().datetime(),
  message: z.string(),
  metadata: z.record(z.string(), z.any()).optional().default({}),
});

export type Event = z.infer<typeof EventSchema>;

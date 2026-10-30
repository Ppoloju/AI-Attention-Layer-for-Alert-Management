import { z } from 'zod';

const metadataSchema = z
  .record(z.string(), z.unknown())
  .default({})
  .superRefine((metadata, context) => {
    if (Object.keys(metadata).length > 50) {
      context.addIssue({
        code: 'custom',
        message: 'Metadata must contain no more than 50 top-level keys.',
      });
    }

    try {
      if (new TextEncoder().encode(JSON.stringify(metadata)).byteLength > 32 * 1024) {
        context.addIssue({
          code: 'custom',
          message: 'Metadata must be no larger than 32 KB.',
        });
      }
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'Metadata must contain only JSON-serializable values.',
      });
    }
  });

export const EventSchema = z.object({
  source: z.enum(['github', 'slack', 'jira', 'prometheus', 'custom']),
  event_type: z.string().trim().min(1).max(100),
  service: z.string().trim().min(1).max(100),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  timestamp: z.string().datetime(),
  message: z.string().trim().min(1).max(10_000),
  metadata: metadataSchema,
});

export type Event = z.infer<typeof EventSchema>;

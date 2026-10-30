import { NextRequest, NextResponse } from 'next/server';
import { EventSchema } from '../../../../shared/schemas/event';
import { isValidEventIngestionKey } from '../../../lib/event-auth';
import EventQueue from '../../../lib/queue';

const queue = new EventQueue();
const MAX_EVENT_BODY_BYTES = 64 * 1024;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.EVENT_INGESTION_API_KEY) {
      return NextResponse.json(
        { error: 'Event ingestion is not configured.' },
        { status: 503 }
      );
    }

    if (!isValidEventIngestionKey(request.headers.get('authorization'))) {
      return NextResponse.json({ error: 'Invalid or missing API key.' }, { status: 401 });
    }

    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_EVENT_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Request body must be no larger than 64 KB.' },
        { status: 413 }
      );
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_EVENT_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Request body must be no larger than 64 KB.' },
        { status: 413 }
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }
    
    const validationResult = EventSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid event', details: validationResult.error.issues },
        { status: 400 }
      );
    }
    
    const event = validationResult.data;
    await queue.enqueue(event);
    
    return NextResponse.json(
      { message: 'Event accepted', event },
      { status: 202 }
    );
  } catch (error) {
    console.error('Error processing event:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : 50;

    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
      return NextResponse.json(
        { error: 'Invalid limit parameter. Must be between 1 and 1000.' },
        { status: 400 }
      );
    }

    const { getEvents } = await import('../../../../shared/lib/db');
    const events = await getEvents(limit);

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

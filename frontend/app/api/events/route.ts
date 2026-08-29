import { NextRequest, NextResponse } from 'next/server';
import { EventSchema } from '../../../../shared/schemas/event';
import EventQueue from '../../../lib/queue';

const queue = new EventQueue();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
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
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    if (isNaN(limit) || limit < 1 || limit > 1000) {
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

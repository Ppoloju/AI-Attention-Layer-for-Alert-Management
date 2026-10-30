import { NextRequest, NextResponse } from 'next/server';
import { getSignalById, updateSignalStatus } from '../../../../../shared/lib/db';
import { getMockSignalById } from '../../mock-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Signal ID is required' },
        { status: 400 }
      );
    }

    const signal = await getSignalById(id);

    if (!signal) {
      return NextResponse.json(
        { error: 'Signal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ signal });
  } catch (error) {
    console.warn('Database offline, returning mock signal details for ID:', error);
    const { id } = await params;
    const mockSignal = getMockSignalById(id);
    if (!mockSignal) {
      return NextResponse.json(
        { error: 'Signal not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({
      signal: mockSignal,
      dataSource: 'demo',
      warning: 'PostgreSQL is unavailable. This demo signal is not live data.',
    });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id: string | undefined;

  try {
    const resolvedParams = await params;
    id = resolvedParams.id;

    if (!id) {
      return NextResponse.json(
        { error: 'Signal ID is required' },
        { status: 400 }
      );
    }

    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > 1024) {
      return NextResponse.json(
        { error: 'Request body must be no larger than 1 KB.' },
        { status: 413 }
      );
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 1024) {
      return NextResponse.json(
        { error: 'Request body must be no larger than 1 KB.' },
        { status: 413 }
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object.' }, { status: 400 });
    }

    const status = 'status' in body ? body.status : undefined;

    if (!status || (status !== 'open' && status !== 'resolved')) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "open" or "resolved".' },
        { status: 400 }
      );
    }

    let updatedSignal;
    try {
      updatedSignal = await updateSignalStatus(id, status);
    } catch (error) {
      console.error('Unable to persist signal status:', error);
      return NextResponse.json(
        {
          error: 'Signal status could not be saved because PostgreSQL is unavailable.',
          dataSource: 'demo',
        },
        { status: 503 }
      );
    }

    if (!updatedSignal) {
      return NextResponse.json(
        { error: 'Signal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ signal: updatedSignal });
  } catch (error) {
    console.error(`Unable to update signal ${id ?? '(unknown)'}:`, error);
    return NextResponse.json(
      { error: 'Unable to update signal status.' },
      { status: 500 }
    );
  }
}

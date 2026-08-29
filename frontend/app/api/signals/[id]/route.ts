import { NextRequest, NextResponse } from 'next/server';
import { getSignalById, updateSignalStatus } from '../../../../../shared/lib/db';
import { getMockSignalById, updateMockSignalStatus } from '../../mock-store';

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
    return NextResponse.json({ signal: mockSignal });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let status: string | undefined;
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

    const body = await request.json();
    status = body.status;

    if (!status || (status !== 'open' && status !== 'resolved')) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "open" or "resolved".' },
        { status: 400 }
      );
    }

    const updatedSignal = await updateSignalStatus(id, status);

    if (!updatedSignal) {
      return NextResponse.json(
        { error: 'Signal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ signal: updatedSignal });
  } catch (error) {
    console.warn('Database offline, updating status in mock store for ID:', error);
    
    if (!id) {
      return NextResponse.json(
        { error: 'Signal ID is required' },
        { status: 400 }
      );
    }

    if (!status || (status !== 'open' && status !== 'resolved')) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "open" or "resolved".' },
        { status: 400 }
      );
    }

    const updatedSignal = updateMockSignalStatus(id, status as 'open' | 'resolved');
    if (!updatedSignal) {
      return NextResponse.json(
        { error: 'Signal not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ signal: updatedSignal });
  }
}
